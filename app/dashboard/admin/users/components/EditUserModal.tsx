'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { updateUser, type UpdateUserInput } from '@/app/actions/user-management'
import { getAgencies } from '@/app/actions/agency-management'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import type { UserRole, UserStatus } from '@prisma/client'

const editUserSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['ADMIN', 'EXECUTIVE', 'ANALYST', 'AGENCY_ADMIN', 'CONTRACTOR'], {
    message: 'Please select a role',
  }),
  agency_id: z.string().optional().nullable(),
}).refine(
  (data) => {
    if (data.role === 'AGENCY_ADMIN' && !data.agency_id) return false
    return true
  },
  { message: 'Agency is required for Agency Admin role', path: ['agency_id'] }
)

type EditUserFormData = z.infer<typeof editUserSchema>

export interface EditableUser {
  id: string
  user_id: string
  full_name: string
  email: string
  role: UserRole | null
  status: UserStatus | null
  agency_id: string | null
  agency: { id: string; name: string } | null
}

interface EditUserModalProps {
  user: EditableUser
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string
}

export function EditUserModal({ user, open, onOpenChange, currentUserId }: EditUserModalProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [agencies, setAgencies] = useState<Array<{ id: string; name: string }>>([])

  const isSelf = user.user_id === currentUserId

  const form = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      full_name: user.full_name,
      role: (user.role as EditUserFormData['role']) || 'EXECUTIVE',
      agency_id: user.agency_id || undefined,
    },
  })

  const selectedRole = form.watch('role')

  // Reset form when user prop changes (opening modal for a different user)
  useEffect(() => {
    if (open) {
      form.reset({
        full_name: user.full_name,
        role: (user.role as EditUserFormData['role']) || 'EXECUTIVE',
        agency_id: user.agency_id || undefined,
      })
    }
  }, [open, user, form])

  // Fetch agencies when AGENCY_ADMIN is selected
  useEffect(() => {
    if (selectedRole === 'AGENCY_ADMIN' && agencies.length === 0) {
      getAgencies()
        .then((result) => {
          setAgencies(result.agencies.map((a: any) => ({ id: a.id, name: a.name })))
        })
        .catch(() => {})
    }
  }, [selectedRole, agencies.length])

  async function onSubmit(data: EditUserFormData) {
    setIsLoading(true)
    try {
      const result = await updateUser(user.id, data as UpdateUserInput)
      if (result.success) {
        toast.success('User updated successfully')
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to update user')
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user details for {user.email}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isLoading} />
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
                      if (value !== 'AGENCY_ADMIN') {
                        form.setValue('agency_id', undefined)
                      }
                    }}
                    value={field.value}
                    disabled={isLoading || isSelf}
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
                  {isSelf && (
                    <FormDescription>You cannot change your own role</FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedRole === 'AGENCY_ADMIN' && (
              <FormField
                control={form.control}
                name="agency_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agency</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
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
                      The agency this admin will manage.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
