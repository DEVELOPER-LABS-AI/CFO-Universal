/**
 * Xero Integration Dashboard Page
 *
 * Displays:
 * - Xero connection status (ACTIVE/DISCONNECTED/TOKEN_EXPIRED/ERROR)
 * - Connect/Disconnect buttons
 * - Sync history table with expandable error details
 * - Manual sync and retry buttons
 * - Unmapped contacts and uncategorized expenses counts
 * - OAuth callback status messages
 */

import React, { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { ConnectionStatus } from '@/components/xero/ConnectionStatus';
import { ConnectXeroButton } from '@/components/xero/ConnectXeroButton';
import { DisconnectXeroButton } from '@/components/xero/DisconnectXeroButton';
import { XeroMonitoringDashboard } from '@/components/xero/XeroMonitoringDashboard';
import { NextSyncCountdown } from '@/components/xero/NextSyncCountdown';
import { XeroAccordionSection } from '@/components/xero/XeroAccordionSection';

async function getConnectionStatus() {
  const user = await requireAuth();
  const organizationId = await getOrganizationId();

  // Get Xero connection if exists
  const connection = await prisma.xeroConnection.findUnique({
    where: { organization_id: organizationId },
  });

  return {
    connection,
    userRole: user.role,
  };
}

export default async function XeroIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; message?: string }>;
}) {
  const params = await searchParams;
  const { connection, userRole } = await getConnectionStatus();

  // Check for OAuth callback status
  const statusMessage = params.status
    ? {
        connected: {
          type: 'success',
          message: 'Xero connected successfully! Sync will start automatically.',
        },
        error: {
          type: 'error',
          message: params.message || 'Failed to connect to Xero',
        },
      }[params.status]
    : null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Xero Integration</h1>
      </div>

      {/* Status Message (OAuth callback) */}
      {statusMessage && (
        <div
          className={`mb-6 p-4 rounded-lg border ${
            statusMessage.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <p className="font-medium">{statusMessage.message}</p>
        </div>
      )}

      {/* Connection Status Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Connection Status
        </h2>

        {connection ? (
          <div className="space-y-4">
            <ConnectionStatus
              status={connection.connection_status as any}
              lastSyncAt={connection.last_sync_at}
            />

            {connection.connection_status === 'ACTIVE' && (
              <div className="pt-2">
                <NextSyncCountdown />
              </div>
            )}

            <div className="pt-4 border-t border-gray-200">
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500 font-medium">Tenant ID</dt>
                  <dd className="text-gray-900 mt-1 font-mono text-xs">
                    {connection.xero_tenant_id}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 font-medium">Connected Since</dt>
                  <dd className="text-gray-900 mt-1">
                    {new Date(connection.created_at).toLocaleDateString()}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-gray-500 font-medium">Scopes</dt>
                  <dd className="text-gray-900 mt-1">
                    <div className="flex flex-wrap gap-2">
                      {connection.scopes_granted.map((scope) => (
                        <span
                          key={scope}
                          className="px-2 py-1 bg-gray-100 rounded text-xs font-mono"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  </dd>
                </div>
              </dl>
            </div>

            {userRole === 'ADMIN' ? (
              <div className="pt-4">
                <DisconnectXeroButton />
              </div>
            ) : (
              <p className="text-sm text-gray-500 pt-4">
                Only Admin or Finance Admin users can disconnect Xero.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600">
              Connect your Xero account to enable automatic invoice and expense
              syncing.
            </p>
            <ConnectXeroButton />
          </div>
        )}
      </div>

      {/* Sync Monitoring Dashboard */}
      {connection && <XeroMonitoringDashboard />}

      {/* Contacts & Expenses Accordion */}
      {connection && (
        <div className="mt-6">
          <XeroAccordionSection />
        </div>
      )}
    </div>
  );
}
