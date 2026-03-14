'use client'

import { formatDistanceToNow } from 'date-fns'
import { UserRoleBadge } from './UserRoleBadge'
import { UserStatusBadge } from './UserStatusBadge'
import { UserActionsDropdown } from './UserActionsDropdown'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { UserRole, UserStatus } from '@prisma/client'

export interface UserForTable {
  id: string
  user_id: string
  full_name: string
  email: string
  role: UserRole | null
  status: UserStatus | null
  agency_id: string | null
  last_login: Date | string | null
  invite_token: string | null
  agency: { id: string; name: string } | null
}

interface UserTableProps {
  users: UserForTable[]
  currentUserId: string
}

export function UserTable({ users, currentUserId }: UserTableProps) {
  if (users.length === 0) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        <p>No users found</p>
        <p className="text-sm">Click &quot;Add User&quot; to invite your first user</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last Login</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">{user.full_name}</TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>
              <UserRoleBadge role={user.role} />
            </TableCell>
            <TableCell>
              <UserStatusBadge status={user.status} />
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {user.last_login
                ? formatDistanceToNow(new Date(user.last_login), { addSuffix: true })
                : 'Never'}
            </TableCell>
            <TableCell className="text-right">
              <UserActionsDropdown
                user={user}
                currentUserId={currentUserId}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
