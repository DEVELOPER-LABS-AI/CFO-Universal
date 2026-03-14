/**
 * GET /api/mercury/sync/cron
 * Cron job endpoint for scheduled Mercury syncs
 *
 * Called daily at 2 AM UTC by Vercel Cron or external scheduler.
 * Requires authorization header for security.
 *
 * Setup in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/mercury/sync/cron",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { runScheduledSync } from '@/lib/mercury/scheduled-sync';
import { getErrorMessage } from '@/lib/utils/error';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security using timing-safe comparison
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!authHeader || !cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const isValid = token.length === cronSecret.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret));
    if (!isValid) {
      console.warn('[Cron] Unauthorized cron request');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Cron] Starting scheduled Mercury sync');

    // Run scheduled sync for all connections
    const result = await runScheduledSync();

    const statusCode = result.failed_connections > 0 ? 207 : 200; // 207 Multi-Status if partial failures

    return NextResponse.json(
      {
        success: result.failed_connections === 0,
        message:
          result.failed_connections === 0
            ? 'All syncs completed successfully'
            : `${result.successful_connections}/${result.total_connections} syncs completed`,
        ...result,
      },
      { status: statusCode }
    );
  } catch (error: unknown) {
    console.error('[Cron] Fatal error during scheduled sync:', error);
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
