import { requireAdmin } from '@/lib/auth/helpers'
import { getAllUsers } from '@/app/actions/user-management'
import { AddUserModal } from './components/AddUserModal'
import { UserTable } from './components/UserTable'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function AdminUsersPage() {
  try {
    // Require admin access — also gives us the current user
    const admin = await requireAdmin()

    // Fetch all users
    const result = await getAllUsers()

    if (!result.success || !result.data) {
      return (
        <div className="container mx-auto py-10">
          <div className="rounded-md bg-red-50 p-4 text-red-800">
            <p className="font-medium">Error loading users</p>
            <p className="text-sm">{result.error || 'Failed to fetch users'}</p>
          </div>
        </div>
      )
    }

    const users = result.data

    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage user accounts, roles, and access permissions
              </CardDescription>
            </div>
            <AddUserModal />
          </CardHeader>
          <CardContent>
            <UserTable users={users} currentUserId={admin.userId} />
          </CardContent>
        </Card>
      </div>
    )
  } catch (error) {
    console.error('[admin/users] Page render error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return (
      <div className="container mx-auto py-10">
        <div className="rounded-md bg-red-50 p-4 text-red-800">
          <p className="font-medium">Error loading users</p>
          <p className="text-sm">{message}</p>
        </div>
      </div>
    )
  }
}
