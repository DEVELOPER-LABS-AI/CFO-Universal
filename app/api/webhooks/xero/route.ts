/**
 * Xero Webhook Endpoint
 *
 * Receives webhook events from Xero and creates notifications
 *
 * Delivery URL: https://your-domain.com/api/webhooks/xero
 *
 * Xero Webhook Events:
 * - invoices.create
 * - invoices.update
 * - contacts.create
 * - contacts.update
 *
 * @see https://developer.xero.com/documentation/webhooks/overview
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Verify Xero webhook signature
 */
function verifyXeroSignature(
  payload: string,
  signature: string,
  webhookKey: string
): boolean {
  const hmac = crypto.createHmac('sha256', webhookKey);
  const hash = hmac.update(payload).digest('base64');
  return hash === signature;
}

/**
 * Map Xero event types to notification types
 */
function getNotificationType(eventCategory: string): any {
  const mapping: Record<string, string> = {
    'INVOICE.CREATE': 'XERO_INVOICE_CREATED',
    'INVOICE.UPDATE': 'XERO_INVOICE_UPDATED',
    'CONTACT.CREATE': 'XERO_CONTACT_CREATED',
    'CONTACT.UPDATE': 'XERO_CONTACT_UPDATED',
  };
  return mapping[eventCategory] || 'INFO';
}

/**
 * Create notification from webhook event
 */
async function createNotification(
  organizationId: string,
  event: any,
  eventCategory: string
) {
  const notificationType = getNotificationType(eventCategory);

  const title = eventCategory
    .replace('.', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const message = `A ${event.resourceId ? `${eventCategory.split('.')[0].toLowerCase()} (${event.resourceId})` : eventCategory.toLowerCase()} was ${eventCategory.includes('CREATE') ? 'created' : 'updated'} in Xero.`;

  await prisma.notification.create({
    data: {
      organization_id: organizationId,
      user_id: null, // Org-wide notification
      type: notificationType as any,
      priority: 'MEDIUM',
      title,
      message,
      source: 'XERO',
      metadata: {
        event_category: eventCategory,
        resource_id: event.resourceId,
        tenant_id: event.tenantId,
        event_id: event.eventId,
      },
      action_url: '/dashboard/integrations/xero',
      related_entity_type: eventCategory.split('.')[0].toLowerCase(),
      related_entity_id: event.resourceId,
    },
  });
}

export async function POST(request: NextRequest) {
  console.log('🔔 Webhook received at:', new Date().toISOString());
  console.log('📋 Headers:', Object.fromEntries(request.headers.entries()));

  try {
    // Get webhook signature from headers
    const signature = request.headers.get('x-xero-signature');
    const webhookKey = process.env.XERO_WEBHOOK_KEY;

    console.log('🔑 Webhook key configured:', !!webhookKey);
    console.log('✍️  Signature present:', !!signature);

    if (!webhookKey) {
      console.error('❌ XERO_WEBHOOK_KEY not configured');
      return NextResponse.json(
        { error: 'Webhook key not configured' },
        { status: 500 }
      );
    }

    // Get raw payload
    const rawPayload = await request.text();
    console.log('📦 Raw payload length:', rawPayload.length);
    console.log('📦 Raw payload:', rawPayload.substring(0, 500)); // First 500 chars

    // Verify signature
    if (signature) {
      const isValid = verifyXeroSignature(rawPayload, signature, webhookKey);
      console.log('🔐 Signature verification result:', isValid);

      if (!isValid) {
        console.error('❌ Invalid Xero webhook signature');
        console.error('Expected signature (from Xero):', signature);
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
      console.log('✅ Signature verified successfully');
    } else {
      console.log('⚠️  No signature provided (might be test request)');
    }

    // Parse payload
    console.log('📋 Parsing JSON payload...');
    const payload = JSON.parse(rawPayload);
    console.log('📋 Parsed payload:', JSON.stringify(payload, null, 2));

    // Store raw webhook event
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        source: 'XERO',
        event_type: 'WEBHOOK_RECEIVED',
        payload: payload,
        headers: {
          signature: signature || null,
        },
        signature: signature || null,
        processed: false,
      },
    });

    // Process events
    const events = payload.events || [];

    for (const event of events) {
      try {
        const { eventCategory, tenantId } = event;

        // Find organization by tenant ID
        const connection = await prisma.xeroConnection.findUnique({
          where: { xero_tenant_id: tenantId },
          select: { organization_id: true },
        });

        if (!connection) {
          console.error(`No organization found for tenant ${tenantId}`);
          continue;
        }

        // Update webhook event with organization
        await prisma.webhookEvent.update({
          where: { id: webhookEvent.id },
          data: { organization_id: connection.organization_id },
        });

        // Create notification
        await createNotification(
          connection.organization_id,
          event,
          eventCategory
        );
      } catch (error) {
        console.error(`Failed to process event:`, error);
      }
    }

    // Mark webhook as processed
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        processed: true,
        processed_at: new Date(),
      },
    });

    console.log('✅ Webhook processed successfully, events:', events.length);
    return NextResponse.json({
      success: true,
      processed: events.length,
    });
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Health check / Intent verification for Xero webhook setup
export async function GET(request: NextRequest) {
  const webhookKey = process.env.XERO_WEBHOOK_KEY;

  console.log('🏥 Webhook health check requested');
  console.log('🔑 Webhook key configured:', !!webhookKey);

  return NextResponse.json({
    status: 'active',
    endpoint: '/api/webhooks/xero',
    url: request.url,
    timestamp: new Date().toISOString(),
    config: {
      webhookKeyConfigured: !!webhookKey,
    },
  });
}
