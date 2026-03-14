'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { updateMarginGoal } from '@/app/actions/cfo-strategist';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

interface MarginGoalSettingsProps {
  companyTarget: number;
  allClients: Array<{
    clientId: string;
    clientName: string;
    target: number | null;
  }>;
}

export function MarginGoalSettings({
  companyTarget: initialCompanyTarget,
  allClients,
}: MarginGoalSettingsProps) {
  const [companyTarget, setCompanyTarget] = useState(String(initialCompanyTarget));
  const [savingCompany, setSavingCompany] = useState(false);
  const [clientTargets, setClientTargets] = useState<Record<string, string>>(
    Object.fromEntries(
      allClients.map((c) => [c.clientId, c.target != null ? String(c.target) : ''])
    )
  );
  const [savingClient, setSavingClient] = useState<string | null>(null);

  const handleSaveCompany = async () => {
    const value = parseFloat(companyTarget);
    if (isNaN(value) || value < 0 || value > 100) {
      toast.error('Enter a valid percentage (0-100)');
      return;
    }
    setSavingCompany(true);
    try {
      const result = await updateMarginGoal({ scope: 'GLOBAL', targetMargin: value });
      if (result.success) {
        toast.success('Company margin target updated');
      } else {
        toast.error(result.error || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update company target');
    } finally {
      setSavingCompany(false);
    }
  };

  const handleSaveClient = async (clientId: string) => {
    const raw = clientTargets[clientId];
    const value = raw === '' ? null : parseFloat(raw);
    if (value !== null && (isNaN(value) || value < 0 || value > 100)) {
      toast.error('Enter a valid percentage (0-100) or leave empty for default');
      return;
    }
    setSavingClient(clientId);
    try {
      const result = await updateMarginGoal({
        scope: 'CLIENT',
        clientId,
        targetMargin: value,
      });
      if (result.success) {
        toast.success(value === null ? 'Client override removed' : 'Client target updated');
      } else {
        toast.error(result.error || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update client target');
    } finally {
      setSavingClient(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Company-wide target */}
      <div className="space-y-2">
        <Label htmlFor="company-target">Company-Wide Target Margin (%)</Label>
        <div className="flex items-center gap-2">
          <Input
            id="company-target"
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={companyTarget}
            onChange={(e) => setCompanyTarget(e.target.value)}
            className="w-32"
            placeholder="25"
          />
          <span className="text-sm text-muted-foreground">%</span>
          <Button
            size="sm"
            onClick={handleSaveCompany}
            disabled={savingCompany}
          >
            {savingCompany ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span className="ml-1">Save</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Default target when no per-client override is set. Defaults to 25% if not configured.
        </p>
      </div>

      {/* Per-client overrides */}
      {allClients.length > 0 && (
        <div className="space-y-2">
          <Label>Per-Client Overrides</Label>
          <p className="text-xs text-muted-foreground">
            Set a custom margin target per client. Leave empty to use the company default.
          </p>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="w-40">Target (%)</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allClients.map((client) => (
                  <TableRow key={client.clientId}>
                    <TableCell className="font-medium">{client.clientName}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={clientTargets[client.clientId] ?? ''}
                        onChange={(e) =>
                          setClientTargets((prev) => ({
                            ...prev,
                            [client.clientId]: e.target.value,
                          }))
                        }
                        placeholder={companyTarget || '25'}
                        className="w-24 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSaveClient(client.clientId)}
                        disabled={savingClient === client.clientId}
                      >
                        {savingClient === client.clientId ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
