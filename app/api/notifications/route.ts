/**
 * Notifications API - List user/organization notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user and organization
    const user = await requireAuth();
    const organizationId = await getOrganizationId();

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');

    // Build filter
    const where: any = {
      organization_id: organizationId,
      OR: [{ user_id: user.userId }, { user_id: null }],
    };

    if (status) {
      where.status = status.toUpperCase();
    }

    // Fetch notifications
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    // Count unread
    const unread_count = await prisma.notification.count({
      where: {
        ...where,
        status: 'UNREAD',
      },
    });

    return NextResponse.json({
      notifications,
      unread_count,
      total: notifications.length,
    });
  } catch (error) {
    console.error('Notifications fetch error:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Account inactive') {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      if (error.message === 'User is not associated with any organization') {
        return NextResponse.json(
          { error: 'User organization not found' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
