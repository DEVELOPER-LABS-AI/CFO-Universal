'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getOrganizationId } from '@/lib/auth/organization';
import { requireAuth } from '@/lib/auth/helpers';
import {
  createShareClassSchema,
  updateShareClassSchema,
  createStakeholderSchema,
  updateStakeholderSchema,
  removeStakeholderSchema,
  recordTransactionSchema,
  generateShareLinkSchema,
  asOfDateSchema,
} from '@/lib/validations/cap-table';
import { calculateOwnershipPercentages, replayTransactionsAsOfDate, calculateAvailableShares } from '@/lib/calculations/cap-table';
import { generateShareToken } from '@/lib/cap-table/share-token';

const CAP_TABLE_PATH = '/dashboard/cap-table';

// ============================================================================
// Share Class Actions (T015-T016)
// ============================================================================

/**
 * Create a new share class within the authenticated user's organization.
 */
export async function createShareClass(data: unknown) {
  const validated = createShareClassSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Check name uniqueness (case-insensitive) within org
  const existing = await prisma.shareClass.findFirst({
    where: {
      organization_id: organizationId,
      name: { equals: validated.name, mode: 'insensitive' },
      deleted_at: null,
    },
  });
  if (existing) {
    throw new Error('A share class with this name already exists');
  }

  const shareClass = await prisma.shareClass.create({
    data: {
      organization_id: organizationId,
      name: validated.name,
      authorized_shares: validated.authorized_shares,
      reserved_shares: validated.reserved_shares,
      price_per_share: validated.price_per_share ?? null,
    },
  });

  revalidatePath(CAP_TABLE_PATH);

  return {
    ...shareClass,
    price_per_share: shareClass.price_per_share ? Number(shareClass.price_per_share) : null,
  };
}

/**
 * Update an existing share class.
 */
export async function updateShareClass(data: unknown) {
  const validated = updateShareClassSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Verify share class belongs to org
  const existing = await prisma.shareClass.findFirst({
    where: { id: validated.id, organization_id: organizationId, deleted_at: null },
    include: {
      holdings: { select: { shares_held: true } },
    },
  });
  if (!existing) {
    throw new Error('Share class not found');
  }

  const totalIssued = existing.holdings.reduce((sum, h) => sum + h.shares_held, 0);

  // Validate authorized >= issued + reserved
  const newAuthorized = validated.authorized_shares ?? existing.authorized_shares;
  const newReserved = validated.reserved_shares ?? existing.reserved_shares;
  if (newAuthorized < totalIssued + newReserved) {
    throw new Error(`Authorized shares (${newAuthorized}) must be >= issued (${totalIssued}) + reserved (${newReserved})`);
  }

  // Check name uniqueness if changed
  if (validated.name && validated.name.toLowerCase() !== existing.name.toLowerCase()) {
    const duplicate = await prisma.shareClass.findFirst({
      where: {
        organization_id: organizationId,
        name: { equals: validated.name, mode: 'insensitive' },
        deleted_at: null,
        NOT: { id: validated.id },
      },
    });
    if (duplicate) {
      throw new Error('A share class with this name already exists');
    }
  }

  const { id, ...updateData } = validated;
  const updated = await prisma.shareClass.update({
    where: { id },
    data: {
      ...(updateData.name !== undefined && { name: updateData.name }),
      ...(updateData.authorized_shares !== undefined && { authorized_shares: updateData.authorized_shares }),
      ...(updateData.reserved_shares !== undefined && { reserved_shares: updateData.reserved_shares }),
      ...(updateData.price_per_share !== undefined && { price_per_share: updateData.price_per_share }),
    },
  });

  revalidatePath(CAP_TABLE_PATH);

  return {
    ...updated,
    price_per_share: updated.price_per_share ? Number(updated.price_per_share) : null,
  };
}

// ============================================================================
// Stakeholder Actions (T017-T019)
// ============================================================================

/**
 * Create a new cap table stakeholder.
 */
export async function createStakeholder(data: unknown) {
  const validated = createStakeholderSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Check email uniqueness within org if provided
  if (validated.email) {
    const existing = await prisma.capTableStakeholder.findFirst({
      where: {
        organization_id: organizationId,
        email: validated.email,
        deleted_at: null,
      },
    });
    if (existing) {
      throw new Error('A stakeholder with this email already exists');
    }
  }

  const stakeholder = await prisma.capTableStakeholder.create({
    data: {
      organization_id: organizationId,
      name: validated.name,
      email: validated.email ?? null,
      role_title: validated.role_title ?? null,
    },
  });

  revalidatePath(CAP_TABLE_PATH);
  return stakeholder;
}

/**
 * Update an existing stakeholder.
 */
export async function updateStakeholder(data: unknown) {
  const validated = updateStakeholderSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Verify stakeholder belongs to org and is not deleted
  const existing = await prisma.capTableStakeholder.findFirst({
    where: { id: validated.id, organization_id: organizationId, deleted_at: null },
  });
  if (!existing) {
    throw new Error('Stakeholder not found');
  }

  // Check email uniqueness if changed
  if (validated.email !== undefined && validated.email !== existing.email) {
    if (validated.email) {
      const duplicate = await prisma.capTableStakeholder.findFirst({
        where: {
          organization_id: organizationId,
          email: validated.email,
          deleted_at: null,
          NOT: { id: validated.id },
        },
      });
      if (duplicate) {
        throw new Error('A stakeholder with this email already exists');
      }
    }
  }

  const { id, ...updateData } = validated;
  const updated = await prisma.capTableStakeholder.update({
    where: { id },
    data: {
      ...(updateData.name !== undefined && { name: updateData.name }),
      ...(updateData.email !== undefined && { email: updateData.email }),
      ...(updateData.role_title !== undefined && { role_title: updateData.role_title }),
    },
  });

  revalidatePath(CAP_TABLE_PATH);
  return updated;
}

/**
 * Soft delete a stakeholder (set deleted_at).
 * Fails if stakeholder still holds shares.
 */
export async function removeStakeholder(data: unknown) {
  const validated = removeStakeholderSchema.parse(data);
  const organizationId = await getOrganizationId();

  const existing = await prisma.capTableStakeholder.findFirst({
    where: { id: validated.id, organization_id: organizationId, deleted_at: null },
    include: { holdings: { where: { shares_held: { gt: 0 } } } },
  });
  if (!existing) {
    throw new Error('Stakeholder not found');
  }

  if (existing.holdings.length > 0) {
    throw new Error('Stakeholder still holds shares. Record a Cancellation transaction first.');
  }

  await prisma.capTableStakeholder.update({
    where: { id: validated.id },
    data: { deleted_at: new Date() },
  });

  revalidatePath(CAP_TABLE_PATH);
  return { success: true };
}

// ============================================================================
// Cap Table Summary Query (T020)
// ============================================================================

/**
 * Get the full cap table summary for the authenticated user's organization.
 */
export async function getCapTableSummary() {
  const organizationId = await getOrganizationId();

  // Fetch non-deleted share classes
  const shareClasses = await prisma.shareClass.findMany({
    where: { organization_id: organizationId, deleted_at: null },
    include: {
      holdings: { select: { shares_held: true } },
    },
    orderBy: { created_at: 'asc' },
  });

  // Fetch non-deleted stakeholders with holdings
  const stakeholders = await prisma.capTableStakeholder.findMany({
    where: { organization_id: organizationId, deleted_at: null },
    include: {
      holdings: {
        include: { share_class: { select: { id: true, name: true } } },
      },
    },
    orderBy: { created_at: 'asc' },
  });

  // Compute issued per class
  const shareClassData = shareClasses.map((sc) => {
    const issuedShares = sc.holdings.reduce((sum, h) => sum + h.shares_held, 0);
    return {
      id: sc.id,
      name: sc.name,
      authorized_shares: sc.authorized_shares,
      reserved_shares: sc.reserved_shares,
      issued_shares: issuedShares,
      available_shares: calculateAvailableShares(sc.authorized_shares, sc.reserved_shares, issuedShares),
      price_per_share: sc.price_per_share ? Number(sc.price_per_share) : null,
    };
  });

  // Total issued across all classes
  const totalIssued = shareClassData.reduce((sum, sc) => sum + sc.issued_shares, 0);

  // Compute stakeholder data with ownership percentages
  const stakeholderData = stakeholders.map((s) => {
    const holdingsWithPercentage = s.holdings
      .filter((h) => h.shares_held > 0)
      .map((h) => {
        const classIssued = shareClassData.find((sc) => sc.id === h.share_class_id)?.issued_shares || 0;
        const totalIssuedForCalc = totalIssued;
        return {
          share_class_id: h.share_class_id,
          share_class_name: h.share_class.name,
          shares_held: h.shares_held,
          ownership_percentage:
            totalIssuedForCalc > 0
              ? Math.round((h.shares_held / totalIssuedForCalc) * 100 * 10000) / 10000
              : 0,
        };
      });

    const totalShares = holdingsWithPercentage.reduce((sum, h) => sum + h.shares_held, 0);
    const totalOwnership = holdingsWithPercentage.reduce((sum, h) => sum + h.ownership_percentage, 0);

    return {
      id: s.id,
      name: s.name,
      email: s.email,
      role_title: s.role_title,
      holdings: holdingsWithPercentage,
      total_shares: totalShares,
      total_ownership_percentage: Math.round(totalOwnership * 10000) / 10000,
    };
  });

  const totals = {
    total_authorized: shareClassData.reduce((sum, sc) => sum + sc.authorized_shares, 0),
    total_issued: totalIssued,
    total_reserved: shareClassData.reduce((sum, sc) => sum + sc.reserved_shares, 0),
    total_available: shareClassData.reduce((sum, sc) => sum + sc.available_shares, 0),
  };

  return { share_classes: shareClassData, stakeholders: stakeholderData, totals };
}

// ============================================================================
// Transaction Actions (T026-T027)
// ============================================================================

/**
 * Record an equity transaction atomically.
 * Creates the transaction and updates holdings in a Prisma $transaction.
 */
export async function recordEquityTransaction(data: unknown) {
  const validated = recordTransactionSchema.parse(data);
  const organizationId = await getOrganizationId();
  const user = await requireAuth();

  const result = await prisma.$transaction(async (tx) => {
    // Verify share class belongs to org
    const shareClass = await tx.shareClass.findFirst({
      where: { id: validated.share_class_id, organization_id: organizationId, deleted_at: null },
      include: { holdings: { select: { shares_held: true } } },
    });
    if (!shareClass) {
      throw new Error('Share class not found');
    }

    // Verify stakeholder IDs belong to org
    if (validated.from_stakeholder_id) {
      const from = await tx.capTableStakeholder.findFirst({
        where: { id: validated.from_stakeholder_id, organization_id: organizationId, deleted_at: null },
      });
      if (!from) throw new Error('Source stakeholder not found');
    }
    if (validated.to_stakeholder_id) {
      const to = await tx.capTableStakeholder.findFirst({
        where: { id: validated.to_stakeholder_id, organization_id: organizationId, deleted_at: null },
      });
      if (!to) throw new Error('Recipient stakeholder not found');
    }

    // Validate share availability
    if (['GRANT', 'PURCHASE'].includes(validated.transaction_type)) {
      const issuedShares = shareClass.holdings.reduce((sum, h) => sum + h.shares_held, 0);
      const available = calculateAvailableShares(
        shareClass.authorized_shares,
        shareClass.reserved_shares,
        issuedShares
      );
      if (available < validated.shares_affected) {
        throw new Error(
          `Insufficient available shares. Available: ${available}, Requested: ${validated.shares_affected}`
        );
      }
    }

    if (['TRANSFER', 'CANCELLATION'].includes(validated.transaction_type)) {
      const fromHolding = await tx.equityHolding.findUnique({
        where: {
          stakeholder_id_share_class_id: {
            stakeholder_id: validated.from_stakeholder_id!,
            share_class_id: validated.share_class_id,
          },
        },
      });
      if (!fromHolding || fromHolding.shares_held < validated.shares_affected) {
        const held = fromHolding?.shares_held ?? 0;
        throw new Error(
          `Stakeholder does not hold enough shares. Held: ${held}, Requested: ${validated.shares_affected}`
        );
      }
    }

    // Create the transaction record
    const transaction = await tx.equityTransaction.create({
      data: {
        organization_id: organizationId,
        transaction_type: validated.transaction_type,
        transaction_date: validated.transaction_date,
        share_class_id: validated.share_class_id,
        from_stakeholder_id: validated.from_stakeholder_id ?? null,
        to_stakeholder_id: validated.to_stakeholder_id ?? null,
        shares_affected: validated.shares_affected,
        price_per_share: validated.price_per_share ?? null,
        notes: validated.notes ?? null,
        created_by: user.userId,
      },
    });

    // Update holdings based on transaction type
    switch (validated.transaction_type) {
      case 'GRANT':
      case 'PURCHASE':
        await tx.equityHolding.upsert({
          where: {
            stakeholder_id_share_class_id: {
              stakeholder_id: validated.to_stakeholder_id!,
              share_class_id: validated.share_class_id,
            },
          },
          create: {
            stakeholder_id: validated.to_stakeholder_id!,
            share_class_id: validated.share_class_id,
            shares_held: validated.shares_affected,
          },
          update: {
            shares_held: { increment: validated.shares_affected },
          },
        });
        break;

      case 'TRANSFER':
        // Decrement from source
        await tx.equityHolding.update({
          where: {
            stakeholder_id_share_class_id: {
              stakeholder_id: validated.from_stakeholder_id!,
              share_class_id: validated.share_class_id,
            },
          },
          data: { shares_held: { decrement: validated.shares_affected } },
        });
        // Increment to destination
        await tx.equityHolding.upsert({
          where: {
            stakeholder_id_share_class_id: {
              stakeholder_id: validated.to_stakeholder_id!,
              share_class_id: validated.share_class_id,
            },
          },
          create: {
            stakeholder_id: validated.to_stakeholder_id!,
            share_class_id: validated.share_class_id,
            shares_held: validated.shares_affected,
          },
          update: {
            shares_held: { increment: validated.shares_affected },
          },
        });
        break;

      case 'CANCELLATION':
        await tx.equityHolding.update({
          where: {
            stakeholder_id_share_class_id: {
              stakeholder_id: validated.from_stakeholder_id!,
              share_class_id: validated.share_class_id,
            },
          },
          data: { shares_held: { decrement: validated.shares_affected } },
        });
        break;
    }

    return transaction;
  });

  revalidatePath(CAP_TABLE_PATH);

  return {
    ...result,
    price_per_share: result.price_per_share ? Number(result.price_per_share) : null,
    transaction_date: result.transaction_date.toISOString(),
    created_at: result.created_at.toISOString(),
  };
}

/**
 * Get transaction history for the authenticated user's organization.
 */
export async function getTransactionHistory() {
  const organizationId = await getOrganizationId();

  const transactions = await prisma.equityTransaction.findMany({
    where: { organization_id: organizationId },
    include: {
      share_class: { select: { id: true, name: true } },
      from_stakeholder: { select: { id: true, name: true } },
      to_stakeholder: { select: { id: true, name: true } },
    },
    orderBy: [{ transaction_date: 'desc' }, { created_at: 'desc' }],
  });

  return transactions.map((t) => ({
    id: t.id,
    transaction_type: t.transaction_type,
    transaction_date: t.transaction_date.toISOString(),
    share_class: t.share_class,
    from_stakeholder: t.from_stakeholder,
    to_stakeholder: t.to_stakeholder,
    shares_affected: t.shares_affected,
    price_per_share: t.price_per_share ? Number(t.price_per_share) : null,
    notes: t.notes,
    created_by: t.created_by,
    created_at: t.created_at.toISOString(),
  }));
}

// ============================================================================
// Sharing Actions (T031)
// ============================================================================

/**
 * Generate a shareable link for the cap table.
 */
export async function generateShareLink(data: unknown) {
  const validated = generateShareLinkSchema.parse(data);
  const organizationId = await getOrganizationId();

  const token = generateShareToken(organizationId, validated.expires_in_days);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = `${appUrl}/share/cap-table/${token}`;
  const expiresAt = new Date(Date.now() + validated.expires_in_days * 86400 * 1000);

  return {
    url,
    expires_at: expiresAt.toISOString(),
  };
}

// ============================================================================
// Point-in-Time Query (T038)
// ============================================================================

/**
 * Get the cap table as it existed on a given date by replaying transactions.
 */
export async function getCapTableAsOfDate(data: unknown) {
  const validated = asOfDateSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Fetch all transactions up to and including the target date, ordered ASC
  const transactions = await prisma.equityTransaction.findMany({
    where: {
      organization_id: organizationId,
      transaction_date: { lte: validated.date },
    },
    orderBy: [{ transaction_date: 'asc' }, { created_at: 'asc' }],
  });

  // Fetch share classes and stakeholders for context
  const shareClasses = await prisma.shareClass.findMany({
    where: { organization_id: organizationId, deleted_at: null },
    orderBy: { created_at: 'asc' },
  });

  const stakeholders = await prisma.capTableStakeholder.findMany({
    where: { organization_id: organizationId, deleted_at: null },
    orderBy: { created_at: 'asc' },
  });

  // Replay transactions
  const { holdings: holdingsMap } = replayTransactionsAsOfDate(transactions, validated.date);

  // Build share class data
  const shareClassData = shareClasses.map((sc) => {
    let issuedShares = 0;
    holdingsMap.forEach((shares, key) => {
      if (key.endsWith(`:${sc.id}`)) {
        issuedShares += shares;
      }
    });
    return {
      id: sc.id,
      name: sc.name,
      authorized_shares: sc.authorized_shares,
      reserved_shares: sc.reserved_shares,
      issued_shares: issuedShares,
      available_shares: calculateAvailableShares(sc.authorized_shares, sc.reserved_shares, issuedShares),
      price_per_share: sc.price_per_share ? Number(sc.price_per_share) : null,
    };
  });

  const totalIssued = shareClassData.reduce((sum, sc) => sum + sc.issued_shares, 0);

  // Build stakeholder data from replayed holdings
  const stakeholderData = stakeholders.map((s) => {
    const holdingsForStakeholder: Array<{
      share_class_id: string;
      share_class_name: string;
      shares_held: number;
      ownership_percentage: number;
    }> = [];

    shareClasses.forEach((sc) => {
      const key = `${s.id}:${sc.id}`;
      const sharesHeld = holdingsMap.get(key) || 0;
      if (sharesHeld > 0) {
        holdingsForStakeholder.push({
          share_class_id: sc.id,
          share_class_name: sc.name,
          shares_held: sharesHeld,
          ownership_percentage:
            totalIssued > 0
              ? Math.round((sharesHeld / totalIssued) * 100 * 10000) / 10000
              : 0,
        });
      }
    });

    const totalShares = holdingsForStakeholder.reduce((sum, h) => sum + h.shares_held, 0);
    const totalOwnership = holdingsForStakeholder.reduce((sum, h) => sum + h.ownership_percentage, 0);

    return {
      id: s.id,
      name: s.name,
      email: s.email,
      role_title: s.role_title,
      holdings: holdingsForStakeholder,
      total_shares: totalShares,
      total_ownership_percentage: Math.round(totalOwnership * 10000) / 10000,
    };
  });

  const totals = {
    total_authorized: shareClassData.reduce((sum, sc) => sum + sc.authorized_shares, 0),
    total_issued: totalIssued,
    total_reserved: shareClassData.reduce((sum, sc) => sum + sc.reserved_shares, 0),
    total_available: shareClassData.reduce((sum, sc) => sum + sc.available_shares, 0),
  };

  return { share_classes: shareClassData, stakeholders: stakeholderData, totals };
}
