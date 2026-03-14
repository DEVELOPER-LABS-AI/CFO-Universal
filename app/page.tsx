import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'

export default async function HomePage() {
  const user = await getUser()

  // Redirect authenticated users to dashboard
  if (user) {
    redirect('/dashboard')
  }

  // Redirect unauthenticated users to login
  redirect('/login')
}
