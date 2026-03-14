/**
 * CFO Strategist Nightly Edge Function.
 *
 * Deno-based handler invoked by pg_cron at 3 AM UTC daily.
 * Authenticates via Supabase service role key, fetches organizations
 * with active integrations, and triggers the nightly computation
 * via the Next.js API route where Prisma is available.
 *
 * Environment variables required:
 *   SUPABASE_URL         - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key for DB access
 *   APP_URL              - Next.js app URL (e.g. https://app.example.com)
 *   CRON_SECRET          - Shared secret for authenticating cron calls
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface OrgResult {
  organizationId: string;
  status: 'success' | 'error';
  recommendations?: { generated: number; updated: number; reactivated: number; conflictsTagged: number };
  reports?: string[];
  alerts?: { alertsCreated: number };
  error?: string;
}

Deno.serve(async (req) => {
  try {
    // Authenticate request
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const appUrl = Deno.env.get('APP_URL')!;

    // Create Supabase client to query organizations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find organizations with active Mercury or Xero connections
    const { data: mercuryOrgs } = await supabase
      .from('mercury_connections')
      .select('organization_id')
      .eq('connection_status', 'ACTIVE')
      .is('deleted_at', null);

    const { data: xeroOrgs } = await supabase
      .from('xero_connections')
      .select('organization_id')
      .eq('connection_status', 'ACTIVE');

    // Deduplicate organization IDs
    const orgIds = new Set<string>();
    for (const row of mercuryOrgs ?? []) orgIds.add(row.organization_id);
    for (const row of xeroOrgs ?? []) orgIds.add(row.organization_id);

    if (orgIds.size === 0) {
      return new Response(
        JSON.stringify({ message: 'No organizations with active integrations', results: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Determine which reports to generate based on day
    const now = new Date();
    const isMonday = now.getUTCDay() === 1;
    const isFirstOfMonth = now.getUTCDate() === 1;

    // Process each organization in parallel with 60s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    const results = await Promise.allSettled(
      [...orgIds].map(async (organizationId): Promise<OrgResult> => {
        try {
          const response = await fetch(`${appUrl}/api/cfo-strategist/nightly`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${cronSecret}`,
            },
            body: JSON.stringify({
              organizationId,
              generateWeekly: isMonday,
              generateMonthly: isFirstOfMonth,
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            const text = await response.text();
            return { organizationId, status: 'error', error: `HTTP ${response.status}: ${text}` };
          }

          const data = await response.json();
          return { organizationId, status: 'success', ...data };
        } catch (err) {
          return {
            organizationId,
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          };
        }
      })
    );

    clearTimeout(timeout);

    const summary = results.map((r) =>
      r.status === 'fulfilled' ? r.value : { status: 'error', error: String(r.reason) }
    );

    const successCount = summary.filter((s) => s.status === 'success').length;
    const errorCount = summary.filter((s) => s.status === 'error').length;

    return new Response(
      JSON.stringify({
        totalOrganizations: orgIds.size,
        success: successCount,
        errors: errorCount,
        isMonday,
        isFirstOfMonth,
        results: summary,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
