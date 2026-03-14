/**
 * T018/T040: GET/POST /api/utilization/targets
 *
 * GET  - Fetch all utilization targets for the organization.
 *        Allowed for ADMIN, EXECUTIVE, and AGENCY_ADMIN (read-only view).
 * POST - Create or upsert a utilization target (ADMIN only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { upsertTargetSchema } from '@/lib/validations/utilization';

/**
 * GET /api/utilization/targets
 *
 * Returns the organization's default target, staff-type overrides,
 * and the list of available staff types from StaffRole.
 * Requires ADMIN, EXECUTIVE, or AGENCY_ADMIN role.
 * AGENCY_ADMIN users see the same org-level targets (read-only).
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const allowedRoles = ['ADMIN', 'EXECUTIVE', 'AGENCY_ADMIN'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Forbidden - admin, executive, or agency admin access required' },
        { status: 403 }
      );
    }

    const organizationId = await getOrganizationId();

    // Fetch all active targets for the organization
    const targets = await prisma.utilizationTarget.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
      },
      orderBy: { staff_type: 'asc' },
    });

    // Fetch available staff types from StaffRole
    const staffRoles = await prisma.staffRole.findMany({
      where: { organization_id: organizationId },
      select: { name: true },
      orderBy: { sort_order: 'asc' },
    });

    const availableStaffTypes = staffRoles.map((r) => r.name);

    // Separate default target (staff_type is null) from overrides
    const defaultTargetRaw = targets.find((t) => t.staff_type === null);
    const overridesRaw = targets.filter((t) => t.staff_type !== null);

    /**
     * Convert a Prisma UtilizationTarget to a plain JSON-safe object.
     * Decimal fields are cast to Number.
     */
    const serialize = (t: (typeof targets)[number]) => ({
      id: t.id,
      staff_type: t.staff_type,
      target_rate: Number(t.target_rate),
      warning_threshold: Number(t.warning_threshold),
      critical_threshold: Number(t.critical_threshold),
      standard_daily_hours: Number(t.standard_daily_hours),
      enabled: t.enabled,
      updated_at: t.updated_at,
    });

    return NextResponse.json({
      default_target: defaultTargetRaw ? serialize(defaultTargetRaw) : null,
      staff_type_overrides: overridesRaw.map(serialize),
      available_staff_types: availableStaffTypes,
    });
  } catch (error) {
    console.error('GET /api/utilization/targets error:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Account inactive') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (error.message === 'User is not associated with any organization') {
        return NextResponse.json({ error: 'User organization not found' }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch utilization targets' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/utilization/targets
 *
 * Creates or upserts a utilization target for the organization.
 * Uses the unique constraint [organization_id, staff_type] for upsert.
 * Requires ADMIN role.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - admin access required' },
        { status: 403 }
      );
    }

    const organizationId = await getOrganizationId();
    const body = await request.json();
    const validated = upsertTargetSchema.parse(body);

    const target = await prisma.utilizationTarget.upsert({
      where: {
        organization_id_staff_type: {
          organization_id: organizationId,
          // Prisma compound unique where doesn't accept null in TS types,
          // but null is valid at runtime for the nullable staff_type field.
          staff_type: (validated.staff_type ?? undefined) as string,
        },
      },
      update: {
        target_rate: validated.target_rate,
        warning_threshold: validated.warning_threshold,
        critical_threshold: validated.critical_threshold,
        standard_daily_hours: validated.standard_daily_hours,
        enabled: validated.enabled,
        deleted_at: null, // Un-soft-delete if previously deleted
      },
      create: {
        organization_id: organizationId,
        staff_type: validated.staff_type,
        target_rate: validated.target_rate,
        warning_threshold: validated.warning_threshold,
        critical_threshold: validated.critical_threshold,
        standard_daily_hours: validated.standard_daily_hours,
        enabled: validated.enabled,
      },
    });

    return NextResponse.json({
      id: target.id,
      staff_type: target.staff_type,
      target_rate: Number(target.target_rate),
      warning_threshold: Number(target.warning_threshold),
      critical_threshold: Number(target.critical_threshold),
      standard_daily_hours: Number(target.standard_daily_hours),
      enabled: target.enabled,
      created_at: target.created_at,
      updated_at: target.updated_at,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/utilization/targets error:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Account inactive') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (error.message === 'User is not associated with any organization') {
        return NextResponse.json({ error: 'User organization not found' }, { status: 404 });
      }
    }

    // Zod validation errors
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json(
        { error: 'Validation failed', details: (error as { issues: unknown[] }).issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create utilization target' },
      { status: 500 }
    );
  }
}
