'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="container mx-auto py-10">
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 max-w-2xl mx-auto">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Dashboard Error</h2>
        <p className="text-sm text-red-700 mb-4">
          {error.message || 'An unexpected error occurred'}
        </p>
        {error.digest && (
          <p className="text-xs text-red-500 mb-4">Digest: {error.digest}</p>
        )}
        <button
          onClick={() => reset()}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
