/**
 * Disconnect Mercury Button Component
 *
 * Opens a confirmation modal and disconnects Mercury account (soft delete).
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getErrorMessage } from '@/lib/utils/error';

interface DisconnectMercuryButtonProps {
  organizationId: string;
  disabled?: boolean;
  className?: string;
  onSuccess?: () => void;
}

export function DisconnectMercuryButton({
  organizationId,
  disabled = false,
  className = '',
  onSuccess,
}: DisconnectMercuryButtonProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDisconnect = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/mercury/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to disconnect Mercury');
      }

      // Success!
      setIsModalOpen(false);

      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      console.error('Error disconnecting Mercury:', err);
      setError(getErrorMessage(err) || 'Failed to disconnect Mercury account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setIsModalOpen(false);
      setError(null);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        disabled={disabled}
        className={`
          inline-flex items-center gap-2 px-4 py-2
          bg-red-600 hover:bg-red-700
          text-white font-medium rounded-lg
          transition-colors duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z" />
        </svg>
        <span>Disconnect Mercury</span>
      </button>

      {/* Confirmation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Disconnect Mercury?
              </h2>
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                <svg
                  className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-yellow-900 mb-1">
                    Warning
                  </p>
                  <p className="text-sm text-yellow-700">
                    Disconnecting Mercury will stop automatic transaction syncing. You can reconnect anytime.
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-600">
                Are you sure you want to disconnect your Mercury account? This will:
              </p>
              <ul className="mt-2 text-sm text-gray-600 list-disc list-inside space-y-1">
                <li>Stop automatic transaction imports</li>
                <li>Disable scheduled sync jobs</li>
                <li>Preserve existing transaction data</li>
              </ul>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Disconnecting...
                  </span>
                ) : (
                  'Disconnect'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
