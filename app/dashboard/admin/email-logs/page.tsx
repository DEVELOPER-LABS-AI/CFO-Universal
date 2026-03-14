import { requireAdmin } from '@/lib/auth/helpers'
import { getEmailLogs } from '@/app/actions/email-log-actions'
import { EmailLogsTable } from './components/EmailLogsTable'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function AdminEmailLogsPage() {
  try {
    await requireAdmin()

    const result = await getEmailLogs()

    if (!result.success || !result.data) {
      return (
        <div className="container mx-auto py-10">
          <div className="rounded-md bg-red-50 p-4 text-red-800">
            <p className="font-medium">Error loading email logs</p>
            <p className="text-sm">{result.error || 'Failed to fetch email logs'}</p>
          </div>
        </div>
      )
    }

    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Email Logs</CardTitle>
              <CardDescription>
                Monitor all outbound emails sent from the platform via Resend
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <EmailLogsTable logs={result.data} />
          </CardContent>
        </Card>
      </div>
    )
  } catch (error) {
    console.error('[admin/email-logs] Page render error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return (
      <div className="container mx-auto py-10">
        <div className="rounded-md bg-red-50 p-4 text-red-800">
          <p className="font-medium">Error loading email logs</p>
          <p className="text-sm">{message}</p>
        </div>
      </div>
    )
  }
}
