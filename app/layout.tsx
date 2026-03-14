import type { Metadata } from 'next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'

// Force Node.js runtime for Prisma and Supabase compatibility
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'DevLabs CFO',
  description: 'Profit Optimization System for Agencies',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
        <SpeedInsights />
      </body>
    </html>
  )
}
