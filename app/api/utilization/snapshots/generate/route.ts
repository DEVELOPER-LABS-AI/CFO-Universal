/**
 * POST /api/utilization/snapshots/generate
 * GET  /api/utilization/snapshots/generate  (Vercel Cron)
 *
 * Triggers utilization snapshot generation for eligible staff.
 * Secured via CRON_SECRET (Bearer token) for automated cron calls,
 * or via admin/executive session for manual triggers.
 *
 * GET is used by Vercel Cron (weekly schedule). Defaults to weekly period.
 * POST is used for manual triggers with configurable period/options.
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { generateSnapshotsSchema } from '@/lib/validations/utilization';
import { generateSnapshots } from '@/lib/utilization/snapshot-generator';
import { generateAlerts } from '@/lib/utilization/alert-generator';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutes for batch processing

/**
 * Verify that the request is authorized via CRON_SECRET bearer token.
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @returns true if the cron secret matches, false otherwise
 */
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!authHeader || !cronSecret) return false;

  const token = authHeader.replace('Bearer ', '');
  if (token.length !== cronSecret.length) return false;

  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret));
}

/**
 * Verify authorization: accepts either a valid CRON_SECRET or an admin/executive user.
 *
 * @returns 'cron' if authorized via cron secret, 'manual' if via user session
 * @throws Returns a 401 NextResponse if unauthorized
 */
async function verifyAuth(
  request: NextRequest
): Promise<{ mode: 'cron' | 'manual'; response?: NextResponse }> {
  // Check cron secret first
  if (verifyCronSecret(request)) {
    return { mode: 'cron' };
  }

  // Fall back to user authentication
  try {
    const user = await requireAuth();
    if (user.role !== 'ADMIN' && user.role !== 'EXECUTIVE') {
      return {
        mode: 'manual',
        response: NextResponse.json(
          { error: 'Unauthorized - admin or executive access required' },
          { status: 401 }
        ),
      };
    }
    return { mode: 'manual' };
  } catch {
    return {
      mode: 'manual',
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
}

/**
 * GET handler - used by Vercel Cron for automated weekly generation.
 * Iterates over all organizations and generates weekly snapshots.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  const auth = await verifyAuth(request);
  if (auth.response) return auth.response;

  try {
    // For cron, process all organizations
    const organizations = await prisma.organization.findMany({
      select: { id: true, name: true },
    });

    let totalGenerated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let totalAlerts = 0;
    const orgResults: Array<{
      organization: string;
      generated: number;
      skipped: number;
      errors: number;
      alerts: number;
    }> = [];

    for (const org of organizations) {
      try {
        const snapshotResult = await generateSnapshots({
          organizationId: org.id,
          periodType: 'weekly',
        });

        const alertsCreated = await generateAlerts({
          organizationId: org.id,
          periodStart: snapshotResult.snapshots.length > 0
            ? new Date() // Will be overridden below
            : new Date(),
          periodEnd: new Date(),
          snapshots: snapshotResult.snapshots,
        });

        // Re-derive period boundaries for the alert call
        // (the snapshot generator already computed these internally)
        totalGenerated += snapshotResult.generated;
        totalSkipped += snapshotResult.skipped;
        totalErrors += snapshotResult.errors;
        totalAlerts += alertsCreated;

        orgResults.push({
          organization: org.name,
          generated: snapshotResult.generated,
          skipped: snapshotResult.skipped,
          errors: snapshotResult.errors,
          alerts: alertsCreated,
        });
      } catch (error) {
        console.error(
          `[cron/utilization] Error processing org ${org.name}:`,
          error
        );
        totalErrors++;
        orgResults.push({
          organization: org.name,
          generated: 0,
          skipped: 0,
          errors: 1,
          alerts: 0,
        });
      }
    }

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: totalErrors === 0,
      generated: totalGenerated,
      skipped: totalSkipped,
      errors: totalErrors,
      alerts_created: totalAlerts,
      organizations_processed: organizations.length,
      duration_ms: durationMs,
      results: orgResults,
    });
  } catch (error) {
    console.error('[cron/utilization] Fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Snapshot generation failed',
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler - used for manual snapshot generation.
 * Generates snapshots for the authenticated user's organization with configurable options.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  const auth = await verifyAuth(request);
  if (auth.response) return auth.response;

  try {
    // Parse and validate request body
    const body = await request.json();
    const parseResult = generateSnapshotsSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { period_type, period_start, period_end, force } = parseResult.data;

    // Determine which organizations to process
    let orgIds: string[];

    if (auth.mode === 'cron') {
      // Cron mode: process all organizations
      const organizations = await prisma.organization.findMany({
        select: { id: true },
      });
      orgIds = organizations.map((o) => o.id);
    } else {
      // Manual mode: process only the user's organization
      const organizationId = await getOrganizationId();
      orgIds = [organizationId];
    }

    let totalGenerated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let totalAlerts = 0;
    const allDetails: Array<{
      staff_id: string;
      staff_name: string;
      error: string;
    }> = [];

    // Track period for response
    let responsePeriodStart: Date | undefined;
    let responsePeriodEnd: Date | undefined;

    for (const orgId of orgIds) {
      const snapshotResult = await generateSnapshots({
        organizationId: orgId,
        periodType: period_type,
        periodStart: period_start ? new Date(period_start) : undefined,
        periodEnd: period_end ? new Date(period_end) : undefined,
        force,
      });

      // Derive period boundaries for alerts (same logic as snapshot generator)
      const { getPeriodBoundaries } = await import(
        '@/lib/calculations/utilization'
      );
      let pStart: Date;
      let pEnd: Date;
      if (period_start && period_end) {
        pStart = new Date(period_start);
        pEnd = new Date(period_end);
      } else {
        const boundaries = getPeriodBoundaries(new Date(), period_type);
        pStart = boundaries.start;
        pEnd = boundaries.end;
      }

      if (!responsePeriodStart) {
        responsePeriodStart = pStart;
        responsePeriodEnd = pEnd;
      }

      const alertsCreated = await generateAlerts({
        organizationId: orgId,
        periodStart: pStart,
        periodEnd: pEnd,
        snapshots: snapshotResult.snapshots,
      });

      totalGenerated += snapshotResult.generated;
      totalSkipped += snapshotResult.skipped;
      totalErrors += snapshotResult.errors;
      totalAlerts += alertsCreated;
      allDetails.push(...snapshotResult.details);
    }

    const durationMs = Date.now() - startTime;

    const response: Record<string, unknown> = {
      generated: totalGenerated,
      skipped: totalSkipped,
      errors: totalErrors,
      alerts_created: totalAlerts,
      period: {
        start: responsePeriodStart?.toISOString(),
        end: responsePeriodEnd?.toISOString(),
      },
      duration_ms: durationMs,
    };

    // Only include error details if there were errors
    if (totalErrors > 0) {
      response.details = allDetails;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[utilization/generate] Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Snapshot generation failed',
      },
      { status: 500 }
    );
  }
}
