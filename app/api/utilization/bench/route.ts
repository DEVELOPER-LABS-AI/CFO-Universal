/**
 * T014/T038: GET /api/utilization/bench
 *
 * Returns bench report data including per-staff utilization, bench cost,
 * bench duration, and organization-level summary metrics.
 *
 * Auth: ADMIN, EXECUTIVE, or AGENCY_ADMIN role required.
 * AGENCY_ADMIN users see only staff belonging to their agency.
 * Query params: month, year, staff_type, engagement_type, sort_by, sort_order, include_all
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { benchQuerySchema } from '@/lib/validations/utilization';
import { generateBenchReport } from '@/lib/calculations/bench-report';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Allow ADMIN, EXECUTIVE, and AGENCY_ADMIN roles
    const allowedRoles = ['ADMIN', 'EXECUTIVE', 'AGENCY_ADMIN'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const organizationId = await getOrganizationId();

    // Parse and validate query parameters
    const { searchParams } = request.nextUrl;
    const rawParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      rawParams[key] = value;
    });

    const parsed = benchQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Pass agency_id for AGENCY_ADMIN scoping
    const agencyId = user.role === 'AGENCY_ADMIN' ? user.agencyId : undefined;
    const report = await generateBenchReport(organizationId, parsed.data, agencyId);

    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Account inactive') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (error.message === 'User is not associated with any organization') {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }
    }
    console.error('Bench report error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
