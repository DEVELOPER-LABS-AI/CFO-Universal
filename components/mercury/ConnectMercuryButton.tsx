/**
 * Connect Mercury Button Component
 *
 * Opens a modal to accept Mercury API key and establish connection.
 * Uses API Key authentication instead of OAuth.
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getErrorMessage } from '@/lib/utils/error';

interface ConnectMercuryButtonProps {
  organizationId: string;
  disabled?: boolean;
  className?: string;
  onSuccess?: () => void;
}

export function ConnectMercuryButton({
  organizationId,
  disabled = false,
  className = '',
  onSuccess,
}: ConnectMercuryButtonProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your Mercury API key');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/mercury/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          organizationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect Mercury');
      }

      // Success!
      setIsModalOpen(false);
      setApiKey('');

      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      console.error('Error connecting Mercury:', err);
      setError(getErrorMessage(err) || 'Failed to connect Mercury account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setIsModalOpen(false);
      setApiKey('');
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
          bg-blue-600 hover:bg-blue-700
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
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
        </svg>
        <span>Connect Mercury</span>
      </button>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Connect Mercury Bank
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

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-4">
                To connect your Mercury account, you'll need an API key from your Mercury dashboard.
              </p>
              <a
                href="https://app.mercury.com/settings/developers"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Get your API key from Mercury →
              </a>
            </div>

            <div className="mb-4">
              <label
                htmlFor="mercury-api-key"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Mercury API Key
              </label>
              <input
                id="mercury-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isLoading) {
                    handleConnect();
                  }
                }}
                disabled={isLoading}
                placeholder="Enter your Mercury API key"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              />
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
                onClick={handleConnect}
                disabled={isLoading || !apiKey.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    Connecting...
                  </span>
                ) : (
                  'Connect'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
