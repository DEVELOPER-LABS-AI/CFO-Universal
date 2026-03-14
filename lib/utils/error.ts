/**
 * Safely extract an error message from an unknown error value.
 * Use in catch blocks typed as `catch (error: unknown)`.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'An unexpected error occurred'
}
