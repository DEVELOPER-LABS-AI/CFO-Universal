/**
 * POST /api/mercury/merchants/promote-fuzzy-subscription
 *
 * Promotes a fuzzy-matched subscription mapping to EXACT confidence.
 * Admin action — confirms that the fuzzy match is correct.
 *
 * Body: { connectionId, normalizedMerchantName, subscriptionId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { promoteToExactMapping } from '@/lib/mercury/subscription-mapper';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';

export async function POST(request: NextRequest) {
  try {
    await requireAdminOrExecutive();

    const body = await request.json();
    const { connectionId, normalizedMerchantName, subscriptionId } = body as {
      connectionId?: string;
      normalizedMerchantName?: string;
      subscriptionId?: string;
    };

    if (!connectionId || !normalizedMerchantName || !subscriptionId) {
      return NextResponse.json(
        { error: 'connectionId, normalizedMerchantName, and subscriptionId are required' },
        { status: 400 }
      );
    }

    // Confirm mapping exists and is currently FUZZY
    const existing = await prisma.merchantMappingCache.findUnique({
      where: {
        connection_id_normalized_merchant_name: {
          connection_id: connectionId,
          normalized_merchant_name: normalizedMerchantName,
        },
      },
      select: {
        id: true,
        subscription_id: true,
        mapping_confidence: true,
        mercury_merchant_name: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }

    if (existing.subscription_id !== subscriptionId) {
      return NextResponse.json(
        { error: 'subscriptionId does not match the current mapping' },
        { status: 400 }
      );
    }

    await promoteToExactMapping(connectionId, normalizedMerchantName, subscriptionId);

    return NextResponse.json({
      success: true,
      merchantName: existing.mercury_merchant_name,
      subscriptionId,
      mapping_confidence: 'EXACT',
    });
  } catch (error) {
    console.error('[POST /api/mercury/merchants/promote-fuzzy-subscription]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
