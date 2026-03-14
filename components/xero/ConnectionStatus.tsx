/**
 * Xero Connection Status Badge Component
 *
 * Displays the current Xero connection status with color-coded badge.
 *
 * Status values:
 * - ACTIVE: Green badge
 * - DISCONNECTED: Gray badge
 * - TOKEN_EXPIRED: Yellow badge
 * - ERROR: Red badge
 */

'use client';

import React from 'react';

type ConnectionStatus = 'ACTIVE' | 'DISCONNECTED' | 'TOKEN_EXPIRED' | 'ERROR';

interface ConnectionStatusProps {
  status: ConnectionStatus;
  lastSyncAt?: Date | null;
  className?: string;
}

export function ConnectionStatus({
  status,
  lastSyncAt,
  className = '',
}: ConnectionStatusProps) {
  const statusConfig = {
    ACTIVE: {
      label: 'Connected',
      color: 'bg-green-100 text-green-800 border-green-200',
      icon: '●',
    },
    DISCONNECTED: {
      label: 'Disconnected',
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      icon: '○',
    },
    TOKEN_EXPIRED: {
      label: 'Token Expired',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      icon: '⚠',
    },
    ERROR: {
      label: 'Error',
      color: 'bg-red-100 text-red-800 border-red-200',
      icon: '✕',
    },
  };

  const config = statusConfig[status];

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${config.color}`}
      >
        <span className="text-base">{config.icon}</span>
        <span>{config.label}</span>
      </div>
      {lastSyncAt && status === 'ACTIVE' && (
        <span className="text-xs text-gray-500">
          Last sync: {new Date(lastSyncAt).toLocaleString()}
        </span>
      )}
    </div>
  );
}
