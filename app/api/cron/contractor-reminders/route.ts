import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { sendMonthlyReminders } from '@/app/actions/contractor-email-actions';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds for cron

/**
 * GET /api/cron/contractor-reminders
 *
 * Vercel Cron route handler that triggers monthly contractor invoice reminders.
 * Verifies the request is authorized via a Bearer token matching CRON_SECRET,
 * then delegates to sendMonthlyReminders() which handles all organization and
 * contractor iteration logic.
 *
 * Expected to be called daily by a Vercel Cron schedule. The sendMonthlyReminders
 * function internally checks whether today is the correct reminder day for each
 * contractor (per-org default or per-contractor override).
 *
 * @param request - The incoming HTTP request (must include Authorization header)
 * @returns JSON response with success status and reminder count, or error
 */
export async function GET(request: Request): Promise<NextResponse> {
  // Verify cron secret from headers using timing-safe comparison
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!authHeader || !cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.replace('Bearer ', '');
  const isValid = token.length === cronSecret.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret));
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sendMonthlyReminders();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[cron/contractor-reminders] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cron job failed' },
      { status: 500 },
    );
  }
}
