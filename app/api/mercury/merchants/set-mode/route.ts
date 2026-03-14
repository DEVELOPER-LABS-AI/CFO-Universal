/**
 * POST /api/mercury/merchants/set-mode
 * Set a merchant's mapping mode to SINGLE or PER_TRANSACTION.
 *
 * When switching to PER_TRANSACTION:
 *   - Clears all entity FKs (contractor, agency, subscription, client, expense_category, staff)
 *   - Sets mapping_mode to PER_TRANSACTION
 *
 * When switching to SINGLE:
 *   - Sets mapping_mode to SINGLE
 *   - Deactivates all merchant-scoped categorization rules
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { getErrorMessage } from '@/lib/utils/error';

export async function POST(request: NextRequest) {
  try {
    await requireAdminOrExecutive();
    const organizationId = await getOrganizationId();

    const body = await request.json();
    const { merchantMappingId, mode } = body;

    if (!merchantMappingId || !mode) {
      return NextResponse.json(
        { error: 'Missing required parameters: merchantMappingId, mode' },
        { status: 400 }
      );
    }

    if (mode !== 'SINGLE' && mode !== 'PER_TRANSACTION') {
      return NextResponse.json(
        { error: 'Invalid mode. Must be SINGLE or PER_TRANSACTION' },
        { status: 400 }
      );
    }

    // Get mapping and verify it belongs to org's connection
    const mapping = await prisma.merchantMappingCache.findUnique({
      where: { id: merchantMappingId },
      select: {
        id: true,
        mercury_merchant_name: true,
        connection_id: true,
        mapping_mode: true,
        connection: {
          select: { organization_id: true },
        },
      },
    });

    if (!mapping) {
      return NextResponse.json({ error: 'Merchant mapping not found' }, { status: 404 });
    }

    if (mapping.connection.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (mapping.mapping_mode === mode) {
      return NextResponse.json({
        success: true,
        message: `Merchant is already in ${mode} mode`,
        mapping: { id: mapping.id, mapping_mode: mode },
      });
    }

    if (mode === 'PER_TRANSACTION') {
      // Switch to PER_TRANSACTION: clear all entity FKs
      await prisma.merchantMappingCache.update({
        where: { id: merchantMappingId },
        data: {
          mapping_mode: 'PER_TRANSACTION',
          contractor_id: null,
          agency_id: null,
          subscription_id: null,
          client_id: null,
          expense_category_id: null,
          staff_id: null,
          mapping_confidence: 'MANUAL',
          mapped_by: 'ADMIN_USER',
          mapped_at: new Date(),
        },
      });
    } else {
      // Switch to SINGLE: reset mode and deactivate merchant-scoped rules
      await prisma.$transaction([
        prisma.merchantMappingCache.update({
          where: { id: merchantMappingId },
          data: {
            mapping_mode: 'SINGLE',
            mapping_confidence: 'MANUAL',
            mapped_by: 'ADMIN_USER',
            mapped_at: new Date(),
          },
        }),
        prisma.transactionCategorizationRule.updateMany({
          where: {
            organization_id: organizationId,
            merchant_name_scope: mapping.mercury_merchant_name,
            is_active: true,
          },
          data: { is_active: false },
        }),
      ]);
    }

    console.log(
      `[Set Mode] Merchant "${mapping.mercury_merchant_name}" set to ${mode}`
    );

    return NextResponse.json({
      success: true,
      mapping: {
        id: merchantMappingId,
        merchant_name: mapping.mercury_merchant_name,
        mapping_mode: mode,
      },
    });
  } catch (error: unknown) {
    console.error('Error setting merchant mapping mode:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
