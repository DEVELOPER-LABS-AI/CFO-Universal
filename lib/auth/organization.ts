import { prisma } from '@/lib/prisma';
import { requireAuth } from './helpers';

/**
 * Get the organization ID for the current authenticated user
 *
 * This function retrieves the organization_id from the UserOrganization table
 * based on the authenticated user's ID.
 *
 * For users with multiple organizations, this returns the first active organization.
 *
 * @throws {Error} If user is not authenticated or has no organization
 * @returns {Promise<string>} The organization ID
 *
 * @example
 * export async function getClients() {
 *   const organizationId = await getOrganizationId();
 *   return await prisma.client.findMany({
 *     where: { organization_id: organizationId }
 *   });
 * }
 */
export async function getOrganizationId(): Promise<string> {
  const user = await requireAuth();

  // Get user's organization from UserOrganization junction table
  const userOrg = await prisma.userOrganization.findFirst({
    where: {
      user_id: user.userId,
    },
    select: {
      organization_id: true,
    },
  });

  if (!userOrg) {
    throw new Error('User is not associated with any organization');
  }

  return userOrg.organization_id;
}

/**
 * Get all organizations the user belongs to
 * Useful for users with multiple organization memberships
 *
 * @returns {Promise<Array<{ id: string; name: string; role: string }>>}
 */
export async function getUserOrganizations() {
  const user = await requireAuth();

  const userOrgs = await prisma.userOrganization.findMany({
    where: {
      user_id: user.userId,
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return userOrgs.map((uo) => ({
    id: uo.organization_id,
    name: uo.organization.name,
    role: uo.role,
  }));
}

/**
 * Check if user has access to a specific organization
 *
 * @param organizationId - The organization ID to check
 * @returns {Promise<boolean>} True if user has access
 */
export async function hasOrganizationAccess(organizationId: string): Promise<boolean> {
  const user = await requireAuth();

  const userOrg = await prisma.userOrganization.findUnique({
    where: {
      user_id_organization_id: {
        user_id: user.userId,
        organization_id: organizationId,
      },
    },
  });

  return !!userOrg;
}

/**
 * Require organization access - throw if user doesn't have access
 *
 * @param organizationId - The organization ID to verify
 * @throws {Error} If user doesn't have access to the organization
 */
export async function requireOrganizationAccess(organizationId: string): Promise<void> {
  const hasAccess = await hasOrganizationAccess(organizationId);

  if (!hasAccess) {
    throw new Error('Access denied to this organization');
  }
}
