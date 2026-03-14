'use server';

import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';
import { revalidatePath } from 'next/cache';
import { createStaffRoleSchema } from '@/lib/validations/staff-role';

const DEFAULT_ROLES = [
  { name: 'BDR', display_name: 'BDR (Business Development Representative)', sort_order: 1 },
  { name: 'ADMIN', display_name: 'Admin', sort_order: 2 },
  { name: 'MARKETING', display_name: 'Marketing', sort_order: 3 },
  { name: 'DEVELOPER', display_name: 'Developer', sort_order: 4 },
  { name: 'MANAGER', display_name: 'Manager', sort_order: 5 },
];

/** Legacy staff_type values that should be renamed during seeding */
const ROLE_RENAMES: Record<string, string> = {
  CONTRACTOR: 'MANAGER',
};

/**
 * Seeds default roles for an organization. Also auto-creates roles for any
 * existing staff_type values in the data that aren't in the defaults.
 */
export async function seedDefaultRoles(organizationId: string) {
  // Rename legacy staff_type values (e.g. CONTRACTOR -> MANAGER)
  for (const [oldName, newName] of Object.entries(ROLE_RENAMES)) {
    await prisma.staff.updateMany({
      where: { organization_id: organizationId, staff_type: oldName },
      data: { staff_type: newName },
    });
    // Clean up old role entry if it exists
    await prisma.staffRole.deleteMany({
      where: { organization_id: organizationId, name: oldName },
    });
  }

  for (const role of DEFAULT_ROLES) {
    await prisma.staffRole.upsert({
      where: {
        organization_id_name: { organization_id: organizationId, name: role.name },
      },
      update: {},
      create: {
        organization_id: organizationId,
        name: role.name,
        display_name: role.display_name,
        is_system: true,
        sort_order: role.sort_order,
      },
    });
  }

  // Auto-create roles for any existing staff_type values not in defaults
  const existingTypes = await prisma.staff.findMany({
    where: { organization_id: organizationId, deleted_at: null },
    select: { staff_type: true },
    distinct: ['staff_type'],
  });

  const defaultNames = new Set(DEFAULT_ROLES.map((r) => r.name));
  const renamedValues = new Set(Object.values(ROLE_RENAMES));
  for (const { staff_type } of existingTypes) {
    if (!defaultNames.has(staff_type) && !renamedValues.has(staff_type)) {
      await prisma.staffRole.upsert({
        where: {
          organization_id_name: { organization_id: organizationId, name: staff_type },
        },
        update: {},
        create: {
          organization_id: organizationId,
          name: staff_type,
          display_name: staff_type.replace(/_/g, ' '),
          is_system: false,
          sort_order: 99,
        },
      });
    }
  }
}

/**
 * Returns all staff roles for the current organization, seeding defaults if none exist.
 */
export async function getStaffRoles() {
  const organizationId = await getOrganizationId();

  let roles = await prisma.staffRole.findMany({
    where: { organization_id: organizationId },
    orderBy: { sort_order: 'asc' },
  });

  // Lazy seed: if no roles exist, seed defaults
  if (roles.length === 0) {
    await seedDefaultRoles(organizationId);
    roles = await prisma.staffRole.findMany({
      where: { organization_id: organizationId },
      orderBy: { sort_order: 'asc' },
    });
  }

  return roles;
}

/**
 * Creates a custom staff role for the current organization.
 */
export async function createStaffRole(data: unknown) {
  const validated = createStaffRoleSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Check for duplicate name
  const existing = await prisma.staffRole.findUnique({
    where: {
      organization_id_name: { organization_id: organizationId, name: validated.name },
    },
  });
  if (existing) throw new Error('A role with this name already exists');

  const maxOrder = await prisma.staffRole.aggregate({
    where: { organization_id: organizationId },
    _max: { sort_order: true },
  });

  const role = await prisma.staffRole.create({
    data: {
      organization_id: organizationId,
      name: validated.name,
      display_name: validated.display_name,
      is_system: false,
      sort_order: (maxOrder._max.sort_order ?? 0) + 1,
    },
  });

  revalidatePath('/dashboard/staff');
  return role;
}

/**
 * Deletes a custom staff role. Blocks if it's a system role or if staff are still using it.
 */
export async function deleteStaffRole(id: string) {
  const organizationId = await getOrganizationId();

  const role = await prisma.staffRole.findFirst({
    where: { id, organization_id: organizationId },
  });
  if (!role) throw new Error('Role not found');
  if (role.is_system) throw new Error('System roles cannot be deleted');

  // Check if any staff use this role
  const staffCount = await prisma.staff.count({
    where: {
      organization_id: organizationId,
      staff_type: role.name,
      deleted_at: null,
    },
  });
  if (staffCount > 0) {
    throw new Error(`Cannot delete role: ${staffCount} staff member(s) still using it`);
  }

  await prisma.staffRole.delete({ where: { id } });

  revalidatePath('/dashboard/staff');
  return { success: true };
}
