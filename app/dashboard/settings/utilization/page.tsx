import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { UtilizationSettingsContent } from './utilization-settings-content';

/**
 * T022: Utilization Targets settings page (server component).
 *
 * Fetches the organization's utilization targets and available staff types,
 * then renders the interactive client content component.
 * Requires ADMIN role.
 */
export default async function UtilizationSettingsPage() {
  const user = await requireAuth();

  if (user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  const organizationId = await getOrganizationId();

  // Fetch targets and staff roles in parallel
  const [targets, staffRoles] = await Promise.all([
    prisma.utilizationTarget.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
      },
      orderBy: { staff_type: 'asc' },
    }),
    prisma.staffRole.findMany({
      where: { organization_id: organizationId },
      select: { name: true },
      orderBy: { sort_order: 'asc' },
    }),
  ]);

  const availableStaffTypes = staffRoles.map((r) => r.name);

  // Separate default target from staff-type overrides
  const defaultTargetRaw = targets.find((t) => t.staff_type === null);
  const overridesRaw = targets.filter((t) => t.staff_type !== null);

  /**
   * Serialize a Prisma UtilizationTarget to a plain JSON-safe object
   * (Decimal -> Number, Date -> ISO string).
   */
  const serialize = (t: (typeof targets)[number]) => ({
    id: t.id,
    staff_type: t.staff_type,
    target_rate: Number(t.target_rate),
    warning_threshold: Number(t.warning_threshold),
    critical_threshold: Number(t.critical_threshold),
    standard_daily_hours: Number(t.standard_daily_hours),
    enabled: t.enabled,
    updated_at: t.updated_at.toISOString(),
  });

  return (
    <div className="container mx-auto py-10 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Utilization Targets
        </h1>
        <p className="text-muted-foreground">
          Configure utilization thresholds for your organization. Set a default
          target and optional overrides per staff type.
        </p>
      </div>

      <UtilizationSettingsContent
        defaultTarget={defaultTargetRaw ? serialize(defaultTargetRaw) : null}
        staffTypeOverrides={overridesRaw.map(serialize)}
        availableStaffTypes={availableStaffTypes}
      />
    </div>
  );
}
