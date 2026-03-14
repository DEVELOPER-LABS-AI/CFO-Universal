'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { updateProject } from '@/app/actions/project-management';

interface EditProjectModalProps {
  /** The project data to edit. */
  project: {
    id: string;
    name: string;
    description: string | null;
    client: { id: string; name: string } | null;
    budget_target: number | null;
    start_date: Date;
    end_date: Date | null;
  };
  /** List of clients for the dropdown. */
  clientList: Array<{ id: string; name: string }>;
  /** The trigger element that opens the modal. */
  trigger: React.ReactNode;
}

/**
 * Modal for editing project details: name, description, client,
 * budget target, and end date.
 */
export function EditProjectModal({
  project,
  clientList,
  trigger,
}: EditProjectModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [clientId, setClientId] = useState(project.client?.id ?? '');
  const [budgetTarget, setBudgetTarget] = useState(
    project.budget_target?.toString() ?? '',
  );
  const [endDate, setEndDate] = useState(
    project.end_date
      ? new Date(project.end_date).toISOString().split('T')[0]
      : '',
  );

  /** Resets form state to current project values when modal opens. */
  function resetForm(): void {
    setName(project.name);
    setDescription(project.description ?? '');
    setClientId(project.client?.id ?? '');
    setBudgetTarget(project.budget_target?.toString() ?? '');
    setEndDate(
      project.end_date
        ? new Date(project.end_date).toISOString().split('T')[0]
        : '',
    );
  }

  /** Submits the updated project data to the server action. */
  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      const data: Record<string, unknown> = {};

      if (name !== project.name) data.name = name;
      if (description !== (project.description ?? ''))
        data.description = description || null;
      const effectiveClientId = clientId === 'none' ? '' : clientId;
      if (effectiveClientId !== (project.client?.id ?? ''))
        data.client_id = effectiveClientId || null;

      const parsedBudget = budgetTarget ? parseFloat(budgetTarget) : null;
      if (parsedBudget !== project.budget_target)
        data.budget_target = parsedBudget;

      const parsedEnd = endDate ? new Date(endDate) : null;
      const existingEnd = project.end_date
        ? new Date(project.end_date).toISOString().split('T')[0]
        : null;
      if ((endDate || null) !== existingEnd) data.end_date = parsedEnd;

      if (Object.keys(data).length === 0) {
        setOpen(false);
        return;
      }

      await updateProject(project.id, data);
      toast({ title: 'Project updated' });
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast({
        title: 'Failed to update project',
        description:
          error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) resetForm();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>
            Update project details.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-name">Project Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
            />
          </div>

          {/* Client */}
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="No client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No client</SelectItem>
                {clientList.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Budget */}
          <div className="space-y-2">
            <Label htmlFor="edit-budget">Budget Target ($)</Label>
            <Input
              id="edit-budget"
              type="number"
              min="0"
              step="0.01"
              value={budgetTarget}
              onChange={(e) => setBudgetTarget(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <Label htmlFor="edit-end-date">End Date</Label>
            <Input
              id="edit-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
