/**
 * Disconnect Xero Button Component
 *
 * Shows a confirmation modal before disconnecting Xero integration.
 * Calls POST /api/xero/oauth/disconnect to remove the connection.
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface DisconnectXeroButtonProps {
  disabled?: boolean;
  className?: string;
}

export function DisconnectXeroButton({
  disabled = false,
  className = '',
}: DisconnectXeroButtonProps) {
  const router = useRouter();
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      setError(null);

      const response = await fetch('/api/xero/oauth/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirm: true }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disconnect Xero');
      }

      // Success - refresh the page to update connection status
      setShowConfirmModal(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsDisconnecting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirmModal(true)}
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
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
        <span>Disconnect Xero</span>
      </button>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Disconnect Xero Integration?
            </h3>
            <p className="text-gray-600 mb-4">
              This will remove your Xero connection and stop automatic syncing.
              Previously synced data will remain in your system but will be
              marked as manual entries.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setError(null);
                }}
                disabled={isDisconnecting}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isDisconnecting ? (
                  <span className="flex items-center gap-2">
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
                  'Yes, Disconnect'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
