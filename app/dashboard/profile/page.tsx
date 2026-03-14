import { requireAuth } from '@/lib/auth/helpers'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, User, Shield } from 'lucide-react'

export default async function ProfilePage() {
  const user = await requireAuth()

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          View and manage your profile information
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
              Your account details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Full Name</p>
                <p className="text-sm text-muted-foreground">{user.fullName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Role</p>
                <p className="text-sm text-muted-foreground">
                  {user.role.charAt(0) + user.role.slice(1).toLowerCase()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
            <CardDescription>
              Update your profile information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Profile editing coming soon. You'll be able to update your name, email, and other details here.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Status</CardTitle>
            <CardDescription>
              Your account status and activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium">Active</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Your account is active and in good standing
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
