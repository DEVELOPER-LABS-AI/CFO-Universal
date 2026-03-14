'use client'

import { LogOut, User, Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { logoutUser } from '@/app/actions/auth'
import type { AuthUser } from '@/lib/auth/helpers'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

interface UserNavProps {
  user: AuthUser
}

export function UserNav({ user }: UserNavProps) {
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await logoutUser()
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
      // Force redirect even if there's an error
      router.push('/login')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-blue-600 text-white">
            <span className="text-sm font-medium">
              {user.fullName.charAt(0).toUpperCase()}
            </span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.fullName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
            <p className="text-xs leading-none text-muted-foreground mt-1">
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {user.role.charAt(0) + user.role.slice(1).toLowerCase()}
              </span>
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
