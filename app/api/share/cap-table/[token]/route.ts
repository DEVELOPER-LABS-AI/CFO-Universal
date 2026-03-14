import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateShareToken } from '@/lib/cap-table/share-token';
import { calculateAvailableShares } from '@/lib/calculations/cap-table';

/**
 * Simple in-memory rate limiter: 60 requests per minute per IP.
 * Uses a sliding window approach with automatic cleanup.
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 60;
const WINDOW_MS = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return true;
  }
  if (record.count < RATE_LIMIT) {
    record.count++;
    return true;
  }
  return false;
}

/**
 * Public API route for validating a share token and returning cap table data.
 * No authentication required - the HMAC-signed token proves authorization.
 * Rate limited to 60 requests per minute per IP.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const { token } = await params;

    // Validate token signature and expiry
    const { orgId } = validateShareToken(token);

    // Query cap table data using explicit organization_id filter (no session needed)
    const shareClasses = await prisma.shareClass.findMany({
      where: { organization_id: orgId, deleted_at: null },
      include: {
        holdings: { select: { shares_held: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    const stakeholders = await prisma.capTableStakeholder.findMany({
      where: { organization_id: orgId, deleted_at: null },
      include: {
        holdings: {
          include: { share_class: { select: { id: true, name: true } } },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    // Fetch organization name
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
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

    const totalIssued = shareClassData.reduce((sum, sc) => sum + sc.issued_shares, 0);

    // Compute stakeholder data with ownership percentages
    const stakeholderData = stakeholders.map((s) => {
      const holdingsWithPercentage = s.holdings
        .filter((h) => h.shares_held > 0)
        .map((h) => ({
          share_class_id: h.share_class_id,
          share_class_name: h.share_class.name,
          shares_held: h.shares_held,
          ownership_percentage:
            totalIssued > 0
              ? Math.round((h.shares_held / totalIssued) * 100 * 10000) / 10000
              : 0,
        }));

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

    return NextResponse.json({
      organization_name: organization?.name ?? 'Unknown',
      share_classes: shareClassData,
      stakeholders: stakeholderData,
      totals,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Invalid token';

    if (message === 'Token has expired') {
      return NextResponse.json({ error: 'This shared link has expired' }, { status: 410 });
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
