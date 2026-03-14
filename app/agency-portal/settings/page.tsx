import { requireAgencyAdmin } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { prisma } from '@/lib/prisma';
import { AgencySettingsContent } from './agency-settings-content';

/**
 * Agency portal overtime settings page (server component).
 * Fetches agency-level config, falling back to org-level defaults.
 */
export default async function AgencySettingsPage() {
  const user = await requireAgencyAdmin();
  const organizationId = await getOrganizationId();

  // Try to fetch agency-specific config first
  const agencyConfig = await prisma.overtimeConfig.findFirst({
    where: {
      organization_id: organizationId,
      agency_id: user.agencyId,
    },
  });

  let usingOrgDefaults = false;
  let initialConfig: {
    weekly_hours_threshold: number;
    overtime_multiplier: number;
    is_enabled: boolean;
  };

  if (agencyConfig) {
    initialConfig = {
      weekly_hours_threshold: Number(agencyConfig.weekly_hours_threshold),
      overtime_multiplier: Number(agencyConfig.overtime_multiplier),
      is_enabled: agencyConfig.is_enabled,
    };
  } else {
    // Fall back to org-level config
    const orgConfig = await prisma.overtimeConfig.findFirst({
      where: {
        organization_id: organizationId,
        agency_id: null,
      },
    });

    if (orgConfig) {
      initialConfig = {
        weekly_hours_threshold: Number(orgConfig.weekly_hours_threshold),
        overtime_multiplier: Number(orgConfig.overtime_multiplier),
        is_enabled: orgConfig.is_enabled,
      };
    } else {
      // Hard defaults when no config exists at any level
      initialConfig = {
        weekly_hours_threshold: 40,
        overtime_multiplier: 1.5,
        is_enabled: true,
      };
    }

    usingOrgDefaults = true;
  }

  return (
    <div className="container mx-auto py-10 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Agency Settings</h1>
        <p className="text-muted-foreground">
          Manage overtime rules and other settings for your agency.
        </p>
      </div>
      <AgencySettingsContent
        initialConfig={initialConfig}
        usingOrgDefaults={usingOrgDefaults}
      />
    </div>
  );
}
