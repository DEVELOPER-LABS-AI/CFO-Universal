/**
 * T036: GET /api/overtime-config — Retrieve overtime config for the org (or agency).
 * Returns defaults if no config exists.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const organizationId = await getOrganizationId();

    const agencyId = request.nextUrl.searchParams.get('agency_id') || undefined;

    // Try to find config for the specified scope
    const config = await prisma.overtimeConfig.findFirst({
      where: {
        organization_id: organizationId,
        agency_id: agencyId ?? null,
      },
    });

    if (config) {
      return NextResponse.json({
        config: {
          id: config.id,
          organization_id: config.organization_id,
          agency_id: config.agency_id,
          weekly_hours_threshold: Number(config.weekly_hours_threshold),
          overtime_multiplier: Number(config.overtime_multiplier),
          is_enabled: config.is_enabled,
          created_at: config.created_at.toISOString(),
          updated_at: config.updated_at.toISOString(),
        },
      });
    }

    // Return defaults
    return NextResponse.json({
      config: {
        id: null,
        organization_id: organizationId,
        agency_id: agencyId ?? null,
        weekly_hours_threshold: 40,
        overtime_multiplier: 1.5,
        is_enabled: true,
        created_at: null,
        updated_at: null,
      },
      is_default: true,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
