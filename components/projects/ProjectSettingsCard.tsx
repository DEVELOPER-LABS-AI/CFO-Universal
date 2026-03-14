'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Settings, Loader2, Save, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';
import { updateProject } from '@/app/actions/project-management';
import { toast } from 'sonner';

interface ProjectSettingsCardProps {
  /** The project ID. */
  projectId: string;
  /** Current budget target value (null if not set). */
  budgetTarget: number | null;
  /** Cumulative total costs across all months. */
  cumulativeCosts: number;
}

/**
 * Inline settings card for the project details page.
 * Allows viewing and editing the budget target with a visual progress bar.
 */
export function ProjectSettingsCard({
  projectId,
  budgetTarget,
  cumulativeCosts,
}: ProjectSettingsCardProps) {
  const router = useRouter();
  const [budget, setBudget] = useState(budgetTarget?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  const parsedBudget = budget ? parseFloat(budget) : null;
  const hasChanged = parsedBudget !== budgetTarget;

  const utilization =
    parsedBudget && parsedBudget > 0
      ? (cumulativeCosts / parsedBudget) * 100
      : null;

  /** Returns color classes based on budget utilization percentage. */
  function getUtilizationColor(pct: number): string {
    if (pct > 100) return 'text-red-600';
    if (pct >= 80) return 'text-amber-600';
    return 'text-green-600';
  }

  /** Returns progress bar color class based on utilization. */
  function getProgressColor(pct: number): string {
    if (pct > 100) return '[&>div]:bg-red-500';
    if (pct >= 80) return '[&>div]:bg-amber-500';
    return '[&>div]:bg-green-500';
  }

  /** Saves the updated budget target via server action. */
  async function handleSave(): Promise<void> {
    if (!hasChanged) return;

    if (parsedBudget !== null && (isNaN(parsedBudget) || parsedBudget < 0)) {
      toast.error('Budget must be a positive number');
      return;
    }

    setSaving(true);
    try {
      await updateProject(projectId, { budget_target: parsedBudget });
      toast.success(
        parsedBudget !== null ? 'Budget target updated' : 'Budget target removed'
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update budget'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">Project Settings</CardTitle>
        <Settings className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Budget Target */}
        <div className="space-y-3">
          <Label htmlFor="project-budget">Budget Target</Label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="project-budget"
                type="number"
                min="0"
                step="0.01"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="0.00"
                className="pl-8"
              />
            </div>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !hasChanged}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span className="ml-1">Save</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Total budget ceiling for this project. Leave empty for no limit.
          </p>
        </div>

        {/* Budget Utilization */}
        {utilization !== null && parsedBudget !== null && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Budget Utilization</span>
              <span className={`font-medium ${getUtilizationColor(utilization)}`}>
                {utilization.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={Math.min(utilization, 100)}
              className={getProgressColor(utilization)}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Spent: {formatCurrency(cumulativeCosts)}</span>
              <span>Budget: {formatCurrency(parsedBudget)}</span>
            </div>
            {utilization > 100 && (
              <p className="text-xs text-red-600 font-medium">
                Over budget by {formatCurrency(cumulativeCosts - parsedBudget)}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
