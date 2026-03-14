'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { TargetForm } from '@/components/utilization/target-form';
import {
  deleteUtilizationTarget,
  toggleUtilizationTarget,
} from '@/app/actions/utilization-targets';

/** Serialized utilization target shape from the server. */
interface SerializedTarget {
  id: string;
  staff_type: string | null;
  target_rate: number;
  warning_threshold: number;
  critical_threshold: number;
  standard_daily_hours: number;
  enabled: boolean;
  updated_at: string;
}

/** Props passed from the server component. */
export interface UtilizationSettingsContentProps {
  /** The organization-wide default target (staff_type = null), or null if not set. */
  defaultTarget: SerializedTarget | null;
  /** Staff-type specific override targets. */
  staffTypeOverrides: SerializedTarget[];
  /** Available staff type names from StaffRole. */
  availableStaffTypes: string[];
}

/**
 * Client component that renders the interactive utilization settings UI.
 * Handles displaying/editing the default target, listing overrides,
 * and adding new staff-type overrides via a dialog.
 */
export function UtilizationSettingsContent({
  defaultTarget,
  staffTypeOverrides,
  availableStaffTypes,
}: UtilizationSettingsContentProps) {
  const router = useRouter();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<SerializedTarget | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  /** Refresh server data after mutations. */
  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  /** Handle successful form save (close dialog + refresh). */
  const handleFormSuccess = useCallback(() => {
    setAddDialogOpen(false);
    setEditingTarget(null);
    refresh();
  }, [refresh]);

  /** Handle deleting a staff-type override. */
  async function handleDelete(targetId: string) {
    if (!confirm('Are you sure you want to delete this staff type override?')) {
      return;
    }

    setDeletingId(targetId);
    try {
      const result = await deleteUtilizationTarget(targetId);
      if (!result.success) {
        alert(result.error);
      } else {
        refresh();
      }
    } catch {
      alert('Failed to delete target');
    } finally {
      setDeletingId(null);
    }
  }

  /** Handle toggling a target's enabled state. */
  async function handleToggle(targetId: string, newEnabled: boolean) {
    setTogglingId(targetId);
    try {
      const result = await toggleUtilizationTarget(targetId, newEnabled);
      if (!result.success) {
        alert(result.error);
      } else {
        refresh();
      }
    } catch {
      alert('Failed to toggle target');
    } finally {
      setTogglingId(null);
    }
  }

  // Filter out staff types that already have an override
  const usedStaffTypes = new Set(
    staffTypeOverrides.map((o) => o.staff_type).filter(Boolean),
  );
  const remainingStaffTypes = availableStaffTypes.filter(
    (t) => !usedStaffTypes.has(t),
  );

  return (
    <div className="space-y-6">
      {/* Default Target Card */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Default</CardTitle>
          <CardDescription>
            The baseline utilization target applied to all staff unless overridden by a
            staff-type-specific rule.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {defaultTarget ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Target Rate:</span>{' '}
                  <span className="font-medium">{defaultTarget.target_rate}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Daily Hours:</span>{' '}
                  <span className="font-medium">{defaultTarget.standard_daily_hours}h</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Warning:</span>{' '}
                  <span className="font-medium text-yellow-600">
                    {defaultTarget.warning_threshold}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Critical:</span>{' '}
                  <span className="font-medium text-red-600">
                    {defaultTarget.critical_threshold}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={defaultTarget.enabled}
                    onCheckedChange={(checked) =>
                      handleToggle(defaultTarget.id, checked)
                    }
                    disabled={togglingId === defaultTarget.id}
                  />
                  <span className="text-sm text-muted-foreground">
                    {defaultTarget.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingTarget(defaultTarget)}
                    >
                      Edit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Organization Default Target</DialogTitle>
                      <DialogDescription>
                        Update the default utilization thresholds for your organization.
                      </DialogDescription>
                    </DialogHeader>
                    <TargetForm
                      availableStaffTypes={availableStaffTypes}
                      existingTarget={defaultTarget}
                      onSuccess={handleFormSuccess}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                No default target configured yet. Create one to start tracking utilization.
              </p>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>Create Default Target</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Organization Default Target</DialogTitle>
                    <DialogDescription>
                      Set the baseline utilization thresholds for your organization.
                    </DialogDescription>
                  </DialogHeader>
                  <TargetForm
                    availableStaffTypes={availableStaffTypes}
                    onSuccess={handleFormSuccess}
                  />
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Staff Type Overrides */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Staff Type Overrides</CardTitle>
            <CardDescription>
              Set different utilization targets per staff type. These override the
              organization default for matching staff.
            </CardDescription>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                disabled={remainingStaffTypes.length === 0}
              >
                Add Override
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Staff Type Override</DialogTitle>
                <DialogDescription>
                  Create a utilization target for a specific staff type.
                </DialogDescription>
              </DialogHeader>
              <TargetForm
                availableStaffTypes={remainingStaffTypes}
                onSuccess={handleFormSuccess}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {staffTypeOverrides.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No staff type overrides configured. All staff use the organization default.
            </p>
          ) : (
            <div className="space-y-3">
              {staffTypeOverrides.map((override) => (
                <div
                  key={override.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{override.staff_type}</div>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>Target: {override.target_rate}%</span>
                      <span className="text-yellow-600">
                        Warn: {override.warning_threshold}%
                      </span>
                      <span className="text-red-600">
                        Crit: {override.critical_threshold}%
                      </span>
                      <span>{override.standard_daily_hours}h/day</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={override.enabled}
                      onCheckedChange={(checked) =>
                        handleToggle(override.id, checked)
                      }
                      disabled={togglingId === override.id}
                    />
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingTarget(override)}
                        >
                          Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            Edit {override.staff_type} Override
                          </DialogTitle>
                          <DialogDescription>
                            Update the utilization thresholds for {override.staff_type} staff.
                          </DialogDescription>
                        </DialogHeader>
                        <TargetForm
                          availableStaffTypes={availableStaffTypes}
                          existingTarget={override}
                          onSuccess={handleFormSuccess}
                        />
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deletingId === override.id}
                      onClick={() => handleDelete(override.id)}
                    >
                      {deletingId === override.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {remainingStaffTypes.length === 0 && staffTypeOverrides.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              All available staff types have overrides configured.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
