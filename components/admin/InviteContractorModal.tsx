'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { inviteContractorSchema, type InviteContractorInput } from '@/lib/validations/contractor-invoice'
import { inviteContractor } from '@/app/actions/contractor-admin-actions'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Mail } from 'lucide-react'

interface InviteContractorModalProps {
  /** Contractor ID to invite */
  contractorId: string
  /** Contractor name for display */
  contractorName: string
  /** Pre-fill email if known */
  defaultEmail?: string
  /** Custom trigger element */
  trigger?: React.ReactNode
  /** Called after successful invitation */
  onInvited?: () => void
}

/**
 * Modal for inviting a contractor to the portal via magic link.
 * Creates a Supabase auth user and links them with CONTRACTOR role.
 */
export function InviteContractorModal({
  contractorId,
  contractorName,
  defaultEmail,
  trigger,
  onInvited,
}: InviteContractorModalProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const form = useForm<InviteContractorInput>({
    resolver: zodResolver(inviteContractorSchema),
    defaultValues: {
      contractor_id: contractorId,
      email: defaultEmail ?? '',
      full_name: contractorName,
    },
  })

  const onSubmit = async (data: InviteContractorInput) => {
    setIsSubmitting(true)
    try {
      const result = await inviteContractor(data)
      if (result.success) {
        toast({ title: 'Invitation sent', description: `Portal invitation sent to ${data.email}` })
        setOpen(false)
        form.reset()
        onInvited?.()
        router.refresh()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to send invitation',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send invitation',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Mail className="h-4 w-4 mr-1" />
            Invite to Portal
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Contractor to Portal</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500">
          Send a magic link invitation to <strong>{contractorName}</strong> so they can access the
          contractor portal to submit invoices and documents.
        </p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Contractor's full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="contractor@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Send Invitation
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
