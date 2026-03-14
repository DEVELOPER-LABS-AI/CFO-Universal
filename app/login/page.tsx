'use client'

import { useState, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSearchParams } from 'next/navigation'
import { sendMagicLink } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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

/**
 * Magic link login form validation schema
 */
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
})

type LoginFormData = z.infer<typeof loginSchema>

function LoginForm() {
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  const errorParam = searchParams.get('error')

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
    },
  })

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true)
    setError(null)

    try {
      const result = await sendMagicLink(data.email)

      if (result.success) {
        setMagicLinkSent(true)
      } else {
        setError(result.error || 'Failed to send login link')
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Login error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Map error params to user-friendly messages
  const getErrorMessage = (errorCode: string | null) => {
    switch (errorCode) {
      case 'profile_not_found':
        return 'Contact your administrator for an invitation.'
      case 'account_inactive':
        return 'Your account has been deactivated. Please contact an administrator.'
      case 'admin_required':
        return 'You do not have permission to access that page.'
      case 'auth_error':
        return 'Authentication failed. Please try again.'
      default:
        return null
    }
  }

  const errorMessage = error || getErrorMessage(errorParam)

  // Show success state after magic link is sent
  if (magicLinkSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              Check your email
            </CardTitle>
            <CardDescription className="text-center">
              We sent a login link to <strong>{form.getValues('email')}</strong>.
              Click the link in the email to sign in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-800 text-center">
              Didn&apos;t receive an email? Check your spam folder or try again.
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setMagicLinkSent(false)
                setError(null)
              }}
            >
              Try a different email
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            DevLabs CFO
          </CardTitle>
          <CardDescription className="text-center">
            Enter your email to receive a login link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {errorMessage && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                  {errorMessage}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Sending link...' : 'Send Magic Link'}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <p className="text-center text-sm text-gray-600">
            Internal tool for DevLabs executives
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
