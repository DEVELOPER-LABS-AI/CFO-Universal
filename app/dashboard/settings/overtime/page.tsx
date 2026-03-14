import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { OvertimeSettingsContent } from './overtime-settings-content';

/**
 * Platform admin overtime settings page (server component).
 * Fetches the org-level overtime config and renders the client form.
 */
export default async function OvertimeSettingsPage() {
  const user = await requireAuth();

  // Only admins and executives can manage org-level overtime rules
  if (user.role !== 'ADMIN' && user.role !== 'EXECUTIVE') {
    redirect('/dashboard');
  }

  const organizationId = await getOrganizationId();

  // Fetch org-level config (agency_id is null)
  const config = await prisma.overtimeConfig.findFirst({
    where: {
      organization_id: organizationId,
      agency_id: null,
    },
  });

  const initialConfig = config
    ? {
        weekly_hours_threshold: Number(config.weekly_hours_threshold),
        overtime_multiplier: Number(config.overtime_multiplier),
        is_enabled: config.is_enabled,
      }
    : {
        weekly_hours_threshold: 40,
        overtime_multiplier: 1.5,
        is_enabled: true,
      };

  return (
    <div className="container mx-auto py-10 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Overtime Settings</h1>
        <p className="text-muted-foreground">
          Configure organization-wide overtime rules for timesheet tracking.
        </p>
      </div>
      <OvertimeSettingsContent initialConfig={initialConfig} />
    </div>
  );
}
