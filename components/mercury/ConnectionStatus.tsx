/**
 * Mercury Connection Status Badge Component
 *
 * Displays the current Mercury connection status with color-coded badge.
 *
 * Status values:
 * - ACTIVE: Green badge
 * - DISCONNECTED: Gray badge
 * - API_ERROR: Red badge
 */

'use client';

import React from 'react';

type MercuryConnectionStatus = 'ACTIVE' | 'DISCONNECTED' | 'API_ERROR';

interface ConnectionStatusProps {
  status: MercuryConnectionStatus;
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
    API_ERROR: {
      label: 'API Error',
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
