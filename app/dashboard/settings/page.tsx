import { requireAuth } from '@/lib/auth/helpers'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ContractorReminderSettings } from '@/components/admin/ContractorReminderSettings'
import { CostAllocationSettings } from '@/components/settings/CostAllocationSettings'
import { EmailSettings } from '@/components/settings/EmailSettings'
import { PaymentFeeSettings } from '@/components/settings/PaymentFeeSettings'
import { ServiceCoverageSettings } from '@/components/settings/ServiceCoverageSettings'
import { MarginGoalSettings } from '@/components/settings/MarginGoalSettings'
import { ThresholdSettings } from '@/components/settings/ThresholdSettings'
import { getGlobalContractorSettings } from '@/app/actions/contractor-admin-actions'
import { getEmailSettings } from '@/app/actions/email-settings'
import { getOrganizationSettings } from '@/app/actions/organization-settings'
import { getFeeDefaults, getServiceCoverageSettings } from '@/app/actions/payment-settings'
import { getMarginGoals, getAnalyzerThresholds } from '@/app/actions/cfo-strategist'
import Link from 'next/link'

export default async function SettingsPage() {
  const user = await requireAuth()
  const [contractorSettings, orgSettings, feeDefaults, coverageSettings, marginGoals, thresholdData, emailSettings] = await Promise.all([
    user.role === 'ADMIN' ? getGlobalContractorSettings() : null,
    getOrganizationSettings(),
    getFeeDefaults(),
    getServiceCoverageSettings(),
    getMarginGoals(),
    getAnalyzerThresholds(),
    user.role === 'ADMIN' ? getEmailSettings() : null,
  ])

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your application settings and preferences
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>
              Connect and manage third-party integrations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <h4 className="font-medium">Xero Integration</h4>
                <p className="text-sm text-muted-foreground">
                  Connect your Xero account for automatic invoice and expense syncing. Syncs daily at 2 AM UTC.
                </p>
              </div>
              <Link href="/dashboard/integrations/xero">
                <Button variant="outline">Manage</Button>
              </Link>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <h4 className="font-medium">Mercury Banking Integration</h4>
                <p className="text-sm text-muted-foreground">
                  Connect your Mercury Bank account for automatic transaction syncing and expense tracking. Syncs daily at 2 AM UTC via AWS Lambda.
                </p>
              </div>
              <Link href="/dashboard/integrations/mercury">
                <Button variant="outline">Manage</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {emailSettings && (
          <Card>
            <CardHeader>
              <CardTitle>Email Configuration</CardTitle>
              <CardDescription>
                Configure Resend email integration for outbound notifications, reminders, and alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmailSettings
                emailEnabled={emailSettings.emailEnabled}
                emailFromName={emailSettings.emailFromName}
                emailFromAddress={emailSettings.emailFromAddress}
                emailReplyTo={emailSettings.emailReplyTo}
                apiKeyConfigured={emailSettings.apiKeyConfigured}
                envFromEmail={emailSettings.envFromEmail}
              />
            </CardContent>
          </Card>
        )}

        {contractorSettings?.success && contractorSettings.data && (
          <Card>
            <CardHeader>
              <CardTitle>Contractor Reminders</CardTitle>
              <CardDescription>
                Configure automated monthly invoice reminders for contractors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContractorReminderSettings
                reminderDay={contractorSettings.data.contractor_reminder_day}
                defaultDocTypes={(contractorSettings.data.contractor_default_doc_types as string[] | null) ?? []}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Cost Allocation</CardTitle>
            <CardDescription>
              Configure how overhead and internal costs are distributed across clients
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CostAllocationSettings includeOwnerPay={orgSettings.includeOwnerPay} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Fee Defaults</CardTitle>
            <CardDescription>
              Default fee percentages by payment method. Applied automatically when linking deposits.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentFeeSettings defaults={feeDefaults} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service Coverage Rules</CardTitle>
            <CardDescription>
              Configure when to warn about expiring coverage and when to suspend service for non-payment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ServiceCoverageSettings
              gracePeriodDays={coverageSettings.gracePeriodDays}
              warningDays={coverageSettings.warningDays}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Margin Goals</CardTitle>
            <CardDescription>
              Set target profit margins for the CFO Strategist to benchmark against
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MarginGoalSettings
              companyTarget={marginGoals.companyTarget}
              allClients={marginGoals.allClients}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analyzer Thresholds</CardTitle>
            <CardDescription>
              Fine-tune the sensitivity of the CFO Strategist recommendation engine
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ThresholdSettings
              thresholds={thresholdData.thresholds}
              defaults={thresholdData.defaults}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
            <CardDescription>
              Manage your account preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Settings page coming soon. You can configure notifications, display preferences, and other settings here.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Configure email and in-app notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Notification settings coming soon.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>
              Manage your security settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Security settings coming soon. You can manage two-factor authentication, sessions, and API keys here.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
