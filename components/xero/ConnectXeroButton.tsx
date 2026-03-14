/**
 * Connect Xero Button Component
 *
 * Triggers the Xero OAuth 2.0 authorization flow.
 * Redirects to /api/xero/oauth/authorize which then redirects to Xero.
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface ConnectXeroButtonProps {
  disabled?: boolean;
  className?: string;
}

export function ConnectXeroButton({
  disabled = false,
  className = '',
}: ConnectXeroButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      // Redirect to OAuth authorize endpoint
      window.location.href = '/api/xero/oauth/authorize';
    } catch (error) {
      console.error('Error connecting to Xero:', error);
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleConnect}
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center gap-2 px-4 py-2
        bg-blue-600 hover:bg-blue-700
        text-white font-medium rounded-lg
        transition-colors duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {isLoading ? (
        <>
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
          <span>Connecting...</span>
        </>
      ) : (
        <>
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
          </svg>
          <span>Connect Xero</span>
        </>
      )}
    </button>
  );
}
