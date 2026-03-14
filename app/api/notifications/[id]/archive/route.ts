/**
 * Archive Notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const organizationId = await getOrganizationId();
    const { id } = await params;

    // Verify the notification belongs to the user's organization
    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { organization_id: true },
    });

    if (!notification || notification.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    await prisma.notification.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        archived_at: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Archive notification error:', error);
    return NextResponse.json(
      { error: 'Failed to archive notification' },
      { status: 500 }
    );
  }
}
