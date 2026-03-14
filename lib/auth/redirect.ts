import { redirect } from 'next/navigation'

/**
 * Redirect to login page
 *
 * Preserves current path for post-login redirect.
 * Use in Server Components when authentication is required.
 *
 * @param currentPath - Optional path to return to after login
 *
 * @example
 * const user = await getCurrentUser()
 * if (!user) redirectToLogin('/dashboard/settings')
 */
export function redirectToLogin(currentPath?: string) {
  const params = new URLSearchParams()
  if (currentPath) {
    params.set('redirect', currentPath)
  }

  redirect(`/login?${params.toString()}`)
}

/**
 * Redirect to dashboard
 *
 * Use after successful login or when redirecting from public pages.
 *
 * @param message - Optional success message to display
 *
 * @example
 * // After login
 * redirectToDashboard('Welcome back!')
 */
export function redirectToDashboard(message?: string) {
  const params = new URLSearchParams()
  if (message) {
    params.set('message', message)
  }

  const url = `/dashboard${params.toString() ? `?${params.toString()}` : ''}`
  redirect(url)
}

/**
 * Redirect to admin users page
 *
 * Use after admin user management operations.
 *
 * @param message - Optional success message to display
 *
 * @example
 * redirectToAdminUsers('User created successfully')
 */
export function redirectToAdminUsers(message?: string) {
  const params = new URLSearchParams()
  if (message) {
    params.set('message', message)
  }

  const url = `/dashboard/admin/users${params.toString() ? `?${params.toString()}` : ''}`
  redirect(url)
}

/**
 * Redirect with error message
 *
 * Generic redirect helper for error states.
 *
 * @param path - Destination path
 * @param error - Error message to display
 *
 * @example
 * redirectWithError('/dashboard', 'Something went wrong')
 */
export function redirectWithError(path: string, error: string) {
  const params = new URLSearchParams()
  params.set('error', error)
  redirect(`${path}?${params.toString()}`)
}
