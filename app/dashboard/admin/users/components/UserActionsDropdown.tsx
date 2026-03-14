'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, UserCheck, UserX, Mail, Trash2 } from 'lucide-react'
import { toggleUserStatus, deleteUser, resendInvitation } from '@/app/actions/user-management'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal'
import { EditUserModal, type EditableUser } from './EditUserModal'

interface UserActionsDropdownProps {
  user: EditableUser & { invite_token: string | null }
  currentUserId: string
}

export function UserActionsDropdown({ user, currentUserId }: UserActionsDropdownProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const isSelf = user.user_id === currentUserId
  const hasPendingInvite = !!user.invite_token

  async function handleToggleStatus() {
    setIsLoading(true)
    try {
      const result = await toggleUserStatus(user.id)
      if (result.success) {
        const newStatus = result.data?.newStatus
        toast.success(
          newStatus === 'ACTIVE'
            ? `${user.full_name} has been activated`
            : `${user.full_name} has been deactivated`
        )
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to toggle status')
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResendInvite() {
    setIsLoading(true)
    try {
      const result = await resendInvitation(user.id)
      if (result.success) {
        toast.success('Invitation resent successfully')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to resend invitation')
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelete() {
    const result = await deleteUser(user.id)
    if (result.success) {
      router.refresh()
    } else {
      throw new Error(result.error || 'Failed to delete user')
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={isLoading}>
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>

          {!isSelf && (
            <DropdownMenuItem onSelect={handleToggleStatus} disabled={isLoading}>
              {user.status === 'ACTIVE' ? (
                <>
                  <UserX className="mr-2 h-4 w-4" />
                  Deactivate
                </>
              ) : (
                <>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Activate
                </>
              )}
            </DropdownMenuItem>
          )}

          {hasPendingInvite && (
            <DropdownMenuItem onSelect={handleResendInvite} disabled={isLoading}>
              <Mail className="mr-2 h-4 w-4" />
              Resend Invitation
            </DropdownMenuItem>
          )}

          {!isSelf && (
            <>
              <DropdownMenuSeparator />
              <DeleteConfirmModal
                entityName="user"
                displayName={user.full_name}
                onConfirm={handleDelete}
                trigger={
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                }
              />
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EditUserModal
        user={user}
        open={editOpen}
        onOpenChange={setEditOpen}
        currentUserId={currentUserId}
      />
    </>
  )
}
