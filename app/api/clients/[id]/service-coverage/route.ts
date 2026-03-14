/**
 * GET /api/clients/[id]/service-coverage
 *
 * Returns service coverage status for a client:
 * - Whether they're covered for the current month
 * - How many months of prepaid service remain
 * - Credit balance and days until shutoff
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServiceCoverage } from '@/lib/calculations/service-coverage';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: clientId } = await context.params;

    // Verify client exists and get org
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, organization_id: true },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const coverage = await getServiceCoverage(clientId, client.organization_id);

    return NextResponse.json(coverage);
  } catch (error) {
    console.error('[GET /api/clients/[id]/service-coverage]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
