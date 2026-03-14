'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import {
  upsertTargetSchema,
  updateTargetSchema,
  type UpsertTargetInput,
  type UpdateTargetInput,
} from '@/lib/validations/utilization';

/** Standard success/error return type for all utilization target actions. */
type ActionResult<T = Record<string, unknown>> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Serialize a Prisma UtilizationTarget row into plain JSON
 * (Decimal -> Number conversion).
 */
function serializeTarget(t: {
  id: string;
  staff_type: string | null;
  target_rate: unknown;
  warning_threshold: unknown;
  critical_threshold: unknown;
  standard_daily_hours: unknown;
  enabled: boolean;
  updated_at: Date;
}) {
  return {
    id: t.id,
    staff_type: t.staff_type,
    target_rate: Number(t.target_rate),
    warning_threshold: Number(t.warning_threshold),
    critical_threshold: Number(t.critical_threshold),
    standard_daily_hours: Number(t.standard_daily_hours),
    enabled: t.enabled,
    updated_at: t.updated_at,
  };
}

/**
 * Create or upsert a utilization target for the current organization.
 * Uses the unique constraint [organization_id, staff_type].
 *
 * @param data - Validated target data (staff_type, thresholds, etc.)
 * @returns ActionResult with the created/updated target
 */
export async function upsertUtilizationTarget(
  data: UpsertTargetInput,
): Promise<ActionResult> {
  try {
    const user = await requireAuth();
    if (user.role !== 'ADMIN') {
      return { success: false, error: 'Forbidden - admin access required' };
    }

    const organizationId = await getOrganizationId();
    const validated = upsertTargetSchema.parse(data);

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
        deleted_at: null,
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

    revalidatePath('/dashboard/utilization');
    revalidatePath('/dashboard/settings/utilization');

    return { success: true, data: serializeTarget(target) };
  } catch (error) {
    console.error('upsertUtilizationTarget error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to save utilization target';
    return { success: false, error: message };
  }
}

/**
 * Update an existing utilization target by ID.
 * Verifies the target belongs to the caller's organization.
 *
 * @param targetId - UUID of the target to update
 * @param data     - Partial update fields
 * @returns ActionResult with the updated target
 */
export async function updateUtilizationTarget(
  targetId: string,
  data: UpdateTargetInput,
): Promise<ActionResult> {
  try {
    const user = await requireAuth();
    if (user.role !== 'ADMIN') {
      return { success: false, error: 'Forbidden - admin access required' };
    }

    const organizationId = await getOrganizationId();
    const validated = updateTargetSchema.parse(data);

    // Verify ownership
    const existing = await prisma.utilizationTarget.findFirst({
      where: {
        id: targetId,
        organization_id: organizationId,
        deleted_at: null,
      },
    });

    if (!existing) {
      return { success: false, error: 'Utilization target not found' };
    }

    const updated = await prisma.utilizationTarget.update({
      where: { id: targetId },
      data: validated,
    });

    revalidatePath('/dashboard/utilization');
    revalidatePath('/dashboard/settings/utilization');

    return { success: true, data: serializeTarget(updated) };
  } catch (error) {
    console.error('updateUtilizationTarget error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to update utilization target';
    return { success: false, error: message };
  }
}

/**
 * Soft-delete a staff-type override target.
 * Cannot delete the organization default (staff_type = null).
 *
 * @param targetId - UUID of the target to delete
 * @returns ActionResult with deletion confirmation
 */
export async function deleteUtilizationTarget(
  targetId: string,
): Promise<ActionResult> {
  try {
    const user = await requireAuth();
    if (user.role !== 'ADMIN') {
      return { success: false, error: 'Forbidden - admin access required' };
    }

    const organizationId = await getOrganizationId();

    const existing = await prisma.utilizationTarget.findFirst({
      where: {
        id: targetId,
        organization_id: organizationId,
        deleted_at: null,
      },
    });

    if (!existing) {
      return { success: false, error: 'Utilization target not found' };
    }

    if (existing.staff_type === null) {
      return {
        success: false,
        error:
          'Cannot delete the organization default target. Disable it instead by setting enabled=false.',
      };
    }

    await prisma.utilizationTarget.update({
      where: { id: targetId },
      data: { deleted_at: new Date() },
    });

    revalidatePath('/dashboard/utilization');
    revalidatePath('/dashboard/settings/utilization');

    return { success: true, data: { deleted: true, id: targetId } };
  } catch (error) {
    console.error('deleteUtilizationTarget error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to delete utilization target';
    return { success: false, error: message };
  }
}

/**
 * Quick toggle of the enabled field on a utilization target.
 *
 * @param targetId - UUID of the target to toggle
 * @param enabled  - New enabled state
 * @returns ActionResult with the updated target
 */
export async function toggleUtilizationTarget(
  targetId: string,
  enabled: boolean,
): Promise<ActionResult> {
  try {
    const user = await requireAuth();
    if (user.role !== 'ADMIN') {
      return { success: false, error: 'Forbidden - admin access required' };
    }

    const organizationId = await getOrganizationId();

    const existing = await prisma.utilizationTarget.findFirst({
      where: {
        id: targetId,
        organization_id: organizationId,
        deleted_at: null,
      },
    });

    if (!existing) {
      return { success: false, error: 'Utilization target not found' };
    }

    const updated = await prisma.utilizationTarget.update({
      where: { id: targetId },
      data: { enabled },
    });

    revalidatePath('/dashboard/utilization');
    revalidatePath('/dashboard/settings/utilization');

    return { success: true, data: serializeTarget(updated) };
  } catch (error) {
    console.error('toggleUtilizationTarget error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to toggle utilization target';
    return { success: false, error: message };
  }
}
