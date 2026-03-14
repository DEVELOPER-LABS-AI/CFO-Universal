/**
 * DELETE /api/mercury/merchants/unmap
 * Remove a merchant mapping by clearing all entity references.
 * The cache row is preserved so the merchant immediately appears in the unmapped queue.
 *
 * Supports single unmap (?id=xxx) or batch unmap (JSON body with ids array).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { getErrorMessage } from '@/lib/utils/error';

export async function DELETE(request: NextRequest) {
  try {
    await requireAdminOrExecutive();
    const organizationId = await getOrganizationId();

    // Verify the connection belongs to this org
    const connection = await prisma.mercuryConnection.findUnique({
      where: { organization_id: organizationId },
      select: { id: true },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Mercury connection not found' },
        { status: 404 }
      );
    }

    // Determine IDs to unmap: single (?id=) or batch (JSON body)
    const { searchParams } = new URL(request.url);
    let mappingIds: string[] = [];
    const singleId = searchParams.get('id');

    if (singleId) {
      mappingIds = [singleId];
    } else {
      try {
        const body = await request.json();
        if (Array.isArray(body.ids) && body.ids.length > 0) {
          mappingIds = body.ids;
        }
      } catch {
        // No body or invalid JSON — fall through to validation
      }
    }

    if (mappingIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing required parameter: id (query) or ids (body array)' },
        { status: 400 }
      );
    }

    // Get merchant names for PER_TRANSACTION rule deactivation
    const mappingsToUnmap = await prisma.merchantMappingCache.findMany({
      where: {
        id: { in: mappingIds },
        connection_id: connection.id,
      },
      select: { id: true, mercury_merchant_name: true, mapping_mode: true },
    });

    if (mappingsToUnmap.length === 0) {
      return NextResponse.json(
        { error: 'No matching merchant mappings found' },
        { status: 404 }
      );
    }

    // Soft-delete: null out all entity references, reset mode to SINGLE
    const result = await prisma.merchantMappingCache.updateMany({
      where: {
        id: { in: mappingIds },
        connection_id: connection.id,
      },
      data: {
        contractor_id: null,
        agency_id: null,
        subscription_id: null,
        client_id: null,
        expense_category_id: null,
        staff_id: null,
        mapping_mode: 'SINGLE',
        mapping_confidence: 'MANUAL',
        confidence_score: null,
        mapped_by: 'ADMIN_USER',
        mapped_at: new Date(),
      },
    });

    // Deactivate merchant-scoped rules for any PER_TRANSACTION merchants being unmapped
    const perTxMerchants = mappingsToUnmap
      .filter((m) => m.mapping_mode === 'PER_TRANSACTION')
      .map((m) => m.mercury_merchant_name);

    if (perTxMerchants.length > 0) {
      await prisma.transactionCategorizationRule.updateMany({
        where: {
          organization_id: organizationId,
          merchant_name_scope: { in: perTxMerchants },
          is_active: true,
        },
        data: { is_active: false },
      });
    }

    return NextResponse.json({
      success: true,
      unmapped_count: result.count,
    });
  } catch (error: unknown) {
    console.error('Error unmapping merchant:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
