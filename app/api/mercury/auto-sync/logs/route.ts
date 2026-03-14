/**
 * GET /api/mercury/auto-sync/logs
 *
 * Returns recent AutoSyncRunLog entries for the authenticated organization.
 *
 * Query params:
 *   limit - Number of records to return (default 10, max 50)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';

export async function GET(request: NextRequest) {
  try {
    await requireAdminOrExecutive();
    const { searchParams } = request.nextUrl;
    const rawLimit = searchParams.get('limit');
    const limit = Math.min(Number(rawLimit) || 10, 50);

    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId query parameter is required' },
        { status: 400 }
      );
    }

    const logs = await prisma.autoSyncRunLog.findMany({
      where: { organization_id: organizationId },
      orderBy: { started_at: 'desc' },
      take: limit,
      select: {
        id: true,
        mercury_sync_log_id: true,
        started_at: true,
        completed_at: true,
        duration_ms: true,
        subscription_transactions_created: true,
        contractor_expense_records_created: true,
        needs_review_count: true,
        engine_error_count: true,
        partial_commit: true,
        errors: true,
        created_at: true,
      },
    });

    return NextResponse.json({ data: logs, total: logs.length });
  } catch (error) {
    console.error('[GET /api/mercury/auto-sync/logs]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
