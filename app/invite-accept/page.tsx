'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { acceptInvitation } from '@/app/actions/user-management'
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

export default function InviteAcceptPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  // Check if user is authenticated via magic link
  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        setError('Invalid or expired invitation link. Please request a new invitation.')
        setIsCheckingAuth(false)
        return
      }

      setUserId(session.user.id)
      setUserEmail(session.user.email || null)
      setIsCheckingAuth(false)
    }

    checkAuth()
  }, [])

  async function onSubmit(data: ResetPasswordFormData) {
    if (!userId) {
      setError('Session expired. Please request a new invitation.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await acceptInvitation(userId, data.password)

      if (result.success) {
        // Redirect to login with success message
        router.push('/login?message=' + encodeURIComponent(result.message || 'Account activated'))
      } else {
        setError(result.error || 'Failed to activate account')
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Accept invitation error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-4 text-sm text-muted-foreground">
                Verifying invitation...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error && !userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center text-red-600">
              Invalid Invitation
            </CardTitle>
            <CardDescription className="text-center">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/login')}
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Welcome to DevLabs CFO
          </CardTitle>
          <CardDescription className="text-center">
            {userEmail && (
              <span className="block mb-2 font-medium text-foreground">
                {userEmail}
              </span>
            )}
            Set your password to activate your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      Minimum 8 characters, including uppercase, lowercase, and number
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Activating account...' : 'Activate Account'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
