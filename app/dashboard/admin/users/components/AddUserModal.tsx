'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { inviteUser, type InviteUserInput } from '@/app/actions/user-management'
import { getAgencies } from '@/app/actions/agency-management'
import { getContractorsForSelect } from '@/app/actions/contractor-management'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { UserPlus } from 'lucide-react'

/**
 * Validation schema for add user form
 */
const addUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['ADMIN', 'EXECUTIVE', 'ANALYST', 'AGENCY_ADMIN', 'CONTRACTOR'], {
    message: 'Please select a role',
  }),
  agency_id: z.string().optional(),
  contractor_id: z.string().optional(),
}).refine(
  (data) => {
    if (data.role === 'AGENCY_ADMIN' && !data.agency_id) {
      return false
    }
    return true
  },
  { message: 'Agency is required for Agency Admin role', path: ['agency_id'] }
).refine(
  (data) => {
    if (data.role === 'CONTRACTOR' && !data.contractor_id) {
      return false
    }
    return true
  },
  { message: 'Contractor is required for Contractor role', path: ['contractor_id'] }
)

type AddUserFormData = z.infer<typeof addUserSchema>

interface AddUserModalProps {
  onUserAdded?: () => void
}

export function AddUserModal({ onUserAdded }: AddUserModalProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [agencies, setAgencies] = useState<Array<{ id: string; name: string }>>([])
  const [contractors, setContractors] = useState<Array<{ id: string; name: string }>>([])

  const form = useForm<AddUserFormData>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      email: '',
      full_name: '',
      role: 'EXECUTIVE',
      agency_id: undefined,
      contractor_id: undefined,
    },
  })

  const selectedRole = form.watch('role')

  // Fetch agencies when AGENCY_ADMIN is selected
  useEffect(() => {
    if (selectedRole === 'AGENCY_ADMIN' && agencies.length === 0) {
      getAgencies()
        .then((result) => {
          setAgencies(result.agencies.map((a) => ({ id: a.id, name: a.name })))
        })
        .catch(() => {
          // Silently fail - agencies list will be empty
        })
    }
  }, [selectedRole, agencies.length])

  // Fetch contractors when CONTRACTOR is selected
  useEffect(() => {
    if (selectedRole === 'CONTRACTOR' && contractors.length === 0) {
      getContractorsForSelect()
        .then((result) => {
          setContractors(result)
        })
        .catch((err) => {
          console.error('Failed to fetch contractors:', err)
        })
    }
  }, [selectedRole, contractors.length])

  async function onSubmit(data: AddUserFormData) {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await inviteUser(data as InviteUserInput)

      if (result.success) {
        setSuccess(result.message || 'User invited successfully')
        form.reset()

        // Close modal after short delay to show success message
        setTimeout(() => {
          setOpen(false)
          setSuccess(null)
          onUserAdded?.()
        }, 1500)
      } else {
        setError(result.error || 'Failed to invite user')
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Form submission error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite New User</DialogTitle>
          <DialogDescription>
            Send an invitation email to a new user. They'll receive a magic link to set
            their password and activate their account.
          </DialogDescription>
        </DialogHeader>

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
                      placeholder="user@example.com"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="John Doe"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value)
                      // Clear agency_id when switching away from AGENCY_ADMIN
                      if (value !== 'AGENCY_ADMIN') {
                        form.setValue('agency_id', undefined)
                      }
                      // Clear contractor_id when switching away from CONTRACTOR
                      if (value !== 'CONTRACTOR') {
                        form.setValue('contractor_id', undefined)
                      }
                    }}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="EXECUTIVE">Executive</SelectItem>
                      <SelectItem value="ANALYST">Analyst</SelectItem>
                      <SelectItem value="AGENCY_ADMIN">Agency Admin</SelectItem>
                      <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Admin: Full access including user management
                    <br />
                    Executive: View all financial data
                    <br />
                    Analyst: View financial data (limited scope)
                    <br />
                    Agency Admin: Manage agency staff, services &amp; invoices
                    <br />
                    Contractor: Submit invoices &amp; view payment status
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Agency selector - only shown for AGENCY_ADMIN role */}
            {selectedRole === 'AGENCY_ADMIN' && (
              <FormField
                control={form.control}
                name="agency_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agency</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an agency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {agencies.map((agency) => (
                          <SelectItem key={agency.id} value={agency.id}>
                            {agency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The agency this admin will manage. They will only see data for this agency.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Contractor selector - only shown for CONTRACTOR role */}
            {selectedRole === 'CONTRACTOR' && (
              <FormField
                control={form.control}
                name="contractor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contractor</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a contractor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contractors.map((contractor) => (
                          <SelectItem key={contractor.id} value={contractor.id}>
                            {contractor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Link this user to a contractor profile. They will access the contractor portal to submit invoices.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
                {success}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send Invitation'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
