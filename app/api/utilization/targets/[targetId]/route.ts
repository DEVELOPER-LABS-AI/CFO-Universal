/**
 * T019: PUT/DELETE /api/utilization/targets/[targetId]
 *
 * PUT    - Update an existing utilization target
 * DELETE - Soft-delete a staff-type override (cannot delete the org default)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { updateTargetSchema } from '@/lib/validations/utilization';

/**
 * PUT /api/utilization/targets/[targetId]
 *
 * Partially updates an existing utilization target.
 * Verifies the target belongs to the user's organization.
 * Requires ADMIN role.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ targetId: string }> },
) {
  try {
    const user = await requireAuth();

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - admin access required' },
        { status: 403 }
      );
    }

    const organizationId = await getOrganizationId();
    const { targetId } = await params;
    const body = await request.json();
    const validated = updateTargetSchema.parse(body);

    // Verify target belongs to user's organization
    const existing = await prisma.utilizationTarget.findFirst({
      where: {
        id: targetId,
        organization_id: organizationId,
        deleted_at: null,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Utilization target not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.utilizationTarget.update({
      where: { id: targetId },
      data: validated,
    });

    return NextResponse.json({
      id: updated.id,
      staff_type: updated.staff_type,
      target_rate: Number(updated.target_rate),
      warning_threshold: Number(updated.warning_threshold),
      critical_threshold: Number(updated.critical_threshold),
      standard_daily_hours: Number(updated.standard_daily_hours),
      enabled: updated.enabled,
      updated_at: updated.updated_at,
    });
  } catch (error) {
    console.error('PUT /api/utilization/targets/[targetId] error:', error);

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
      { error: 'Failed to update utilization target' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/utilization/targets/[targetId]
 *
 * Soft-deletes a staff-type override target.
 * Cannot delete the organization default (staff_type = null);
 * the default should be disabled instead via enabled=false.
 * Requires ADMIN role.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ targetId: string }> },
) {
  try {
    const user = await requireAuth();

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - admin access required' },
        { status: 403 }
      );
    }

    const organizationId = await getOrganizationId();
    const { targetId } = await params;

    // Verify target belongs to user's organization
    const existing = await prisma.utilizationTarget.findFirst({
      where: {
        id: targetId,
        organization_id: organizationId,
        deleted_at: null,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Utilization target not found' },
        { status: 404 }
      );
    }

    // Prevent deleting the organization default target
    if (existing.staff_type === null) {
      return NextResponse.json(
        {
          error:
            'Cannot delete the organization default target. Disable it instead by setting enabled=false.',
        },
        { status: 400 }
      );
    }

    // Soft delete
    await prisma.utilizationTarget.update({
      where: { id: targetId },
      data: { deleted_at: new Date() },
    });

    return NextResponse.json({ deleted: true, id: targetId });
  } catch (error) {
    console.error('DELETE /api/utilization/targets/[targetId] error:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Account inactive') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (error.message === 'User is not associated with any organization') {
        return NextResponse.json({ error: 'User organization not found' }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: 'Failed to delete utilization target' },
      { status: 500 }
    );
  }
}
