/**
 * Internal API route for CFO Strategist nightly computation.
 *
 * Called by the Supabase Edge Function (or pg_cron) to run the
 * recommendation engine, generate reports, and check alerts
 * for a specific organization.
 *
 * Authenticated via CRON_SECRET bearer token.
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { generateRecommendations } from '@/lib/cfo-strategist/recommendation-engine';
import {
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
} from '@/lib/cfo-strategist/report-generator';
import { checkAndCreateAlerts } from '@/lib/cfo-strategist/alerts';
import { generateSnapshots } from '@/lib/utilization/snapshot-generator';
import { generateAlerts } from '@/lib/utilization/alert-generator';

export async function POST(req: NextRequest) {
  // Authenticate via shared secret using timing-safe comparison
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!authHeader || !cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.replace('Bearer ', '');
  const isValid = token.length === cronSecret.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret));
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { organizationId, generateWeekly, generateMonthly } = body as {
    organizationId: string;
    generateWeekly?: boolean;
    generateMonthly?: boolean;
  };

  if (!organizationId) {
    return NextResponse.json(
      { error: 'organizationId is required' },
      { status: 400 }
    );
  }

  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();

  try {
    // 1. Run recommendation engine
    const recommendations = await generateRecommendations(
      organizationId,
      month,
      year
    );

    // 2. Generate reports
    const reports: string[] = [];

    await generateDailyReport(organizationId);
    reports.push('DAILY');

    if (generateWeekly) {
      await generateWeeklyReport(organizationId);
      reports.push('WEEKLY');
    }

    if (generateMonthly) {
      await generateMonthlyReport(organizationId);
      reports.push('MONTHLY');
    }

    // 3. Check and create alerts
    const alerts = await checkAndCreateAlerts(organizationId, month, year);

    // 4. Generate utilization snapshots and alerts
    let utilizationResult = null;
    let utilizationAlerts = 0;
    try {
      const snapshotResult = await generateSnapshots({
        organizationId,
        periodType: 'monthly',
        force: false,
      });

      utilizationResult = {
        generated: snapshotResult.generated,
        skipped: snapshotResult.skipped,
        errors: snapshotResult.errors,
      };

      // Generate alerts for any snapshots that breached thresholds
      if (snapshotResult.snapshots.length > 0) {
        const boundaries = getUtilizationPeriodBoundaries(now);
        utilizationAlerts = await generateAlerts({
          organizationId,
          periodStart: boundaries.start,
          periodEnd: boundaries.end,
          snapshots: snapshotResult.snapshots,
        });
      }
    } catch (error) {
      console.error(
        `[cfo-strategist-nightly] Utilization snapshot error for org ${organizationId}:`,
        error
      );
      utilizationResult = {
        generated: 0,
        skipped: 0,
        errors: 1,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    return NextResponse.json({
      recommendations,
      reports,
      alerts,
      utilization: {
        snapshots: utilizationResult,
        alertsGenerated: utilizationAlerts,
      },
    });
  } catch (error) {
    console.error(
      `[cfo-strategist-nightly] Error for org ${organizationId}:`,
      error
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * Calculate monthly period boundaries for utilization snapshots.
 * Returns the first and last day of the current month.
 */
function getUtilizationPeriodBoundaries(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getUTCFullYear(), date.getUTCMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date.getUTCFullYear(), date.getUTCMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
