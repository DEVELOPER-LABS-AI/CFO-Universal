'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, Trash2, History, Plus, StopCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';
import {
  updateClientServiceRate,
  removeServiceFromClient,
  getServiceRateHistory,
  setServiceRateHistory,
  deleteServiceRateHistory,
  getClientContracts,
  terminateServiceContract,
} from '@/app/actions/service-management';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { getErrorMessage } from '@/lib/utils/error';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface ClientServiceRow {
  service: {
    id: string;
    name: string;
    standard_rate: any;
    billing_type: string | null;
  };
  custom_rate: any;
}

interface RateHistoryEntry {
  id: string;
  rate: number;
  effectiveMonth: number;
  effectiveYear: number;
  createdAt: string | Date;
}

interface ContractRow {
  id: string;
  billing_model: string;
  status: string;
  start_month: number;
  start_year: number;
  end_month: number | null;
  end_year: number | null;
  monthly_rate: number | null;
  project_fee: number | null;
  term_months: number | null;
  total_value: number | null;
  notes: string | null;
  service: { id: string; name: string };
  created_at: string;
}

interface ClientServicesTableProps {
  clientId: string;
  services: ClientServiceRow[];
}

/**
 * T020: Editable table of services with contract display and management.
 * Shows active contracts with billing model badges, rate, period range, status.
 * Includes End Contract dialog and historical contract section.
 */
export function ClientServicesTable({ clientId, services }: ClientServicesTableProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  // Contract state
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [showHistorical, setShowHistorical] = useState(false);

  // End Contract dialog state
  const [endContractOpen, setEndContractOpen] = useState(false);
  const [endContractId, setEndContractId] = useState<string | null>(null);
  const [endMonth, setEndMonth] = useState(String(new Date().getMonth() + 1));
  const [endYear, setEndYear] = useState(String(new Date().getFullYear()));
  const [isTerminating, setIsTerminating] = useState(false);

  // Rate history dialog state
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyServiceId, setHistoryServiceId] = useState<string | null>(null);
  const [historyServiceName, setHistoryServiceName] = useState('');
  const [rateHistory, setRateHistory] = useState<RateHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Add history entry form
  const [newRate, setNewRate] = useState('');
  const [newMonth, setNewMonth] = useState(String(new Date().getMonth() + 1));
  const [newYear, setNewYear] = useState(String(new Date().getFullYear()));
  const [addingEntry, setAddingEntry] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch contracts on mount
  const loadContracts = useCallback(async () => {
    try {
      setContractsLoading(true);
      const result = await getClientContracts({ client_id: clientId });
      setContracts(result.contracts);
    } catch {
      // Contracts may not exist yet
    } finally {
      setContractsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  // Group contracts by service
  const activeContractsByService = new Map<string, ContractRow[]>();
  const historicalContracts: ContractRow[] = [];
  for (const c of contracts) {
    if (c.status === 'ACTIVE') {
      const list = activeContractsByService.get(c.service.id) ?? [];
      list.push(c);
      activeContractsByService.set(c.service.id, list);
    } else {
      historicalContracts.push(c);
    }
  }

  const handleSaveRate = async (serviceId: string, value: string) => {
    const parsed = parseFloat(value);
    const currentCustom = services.find((s) => s.service.id === serviceId)?.custom_rate;
    const currentValue = currentCustom ? Number(currentCustom) : null;
    const newValue = isNaN(parsed) || value.trim() === '' ? null : parsed;
    if (newValue === currentValue) return;
    if (newValue !== null && newValue <= 0) return;

    setSavingId(serviceId);
    try {
      await updateClientServiceRate({
        client_id: clientId,
        service_id: serviceId,
        custom_rate: newValue,
      });
      toast({ title: 'Rate updated', description: `Effective from ${MONTH_NAMES[new Date().getMonth()]} ${new Date().getFullYear()}` });
      router.refresh();
    } catch (err: unknown) {
      toast({ title: 'Error', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  const handleRemove = async (serviceId: string, serviceName: string) => {
    if (!confirm(`Remove "${serviceName}" from this client?`)) return;
    setRemovingId(serviceId);
    try {
      await removeServiceFromClient(clientId, serviceId);
      toast({ title: 'Service removed' });
      router.refresh();
    } catch (err: unknown) {
      toast({ title: 'Error', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setRemovingId(null);
    }
  };

  const handleEndContract = async () => {
    if (!endContractId) return;
    setIsTerminating(true);
    try {
      const result = await terminateServiceContract({
        contract_id: endContractId,
        end_month: Number(endMonth),
        end_year: Number(endYear),
      });
      if (result && 'success' in result && !result.success) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Contract terminated' });
      setEndContractOpen(false);
      setEndContractId(null);
      await loadContracts();
      router.refresh();
    } catch (err: unknown) {
      toast({ title: 'Error', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setIsTerminating(false);
    }
  };

  const openEndContract = (contractId: string) => {
    setEndContractId(contractId);
    setEndMonth(String(new Date().getMonth() + 1));
    setEndYear(String(new Date().getFullYear()));
    setEndContractOpen(true);
  };

  const openRateHistory = async (serviceId: string, serviceName: string) => {
    setHistoryServiceId(serviceId);
    setHistoryServiceName(serviceName);
    setHistoryDialogOpen(true);
    setHistoryLoading(true);
    setNewRate('');
    try {
      const history = await getServiceRateHistory(clientId, serviceId);
      setRateHistory(history);
    } catch (err: unknown) {
      toast({ title: 'Error loading rate history', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleAddHistoryEntry = async () => {
    if (!historyServiceId || !newRate) return;
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate < 0) return;

    setAddingEntry(true);
    try {
      await setServiceRateHistory({
        client_id: clientId,
        service_id: historyServiceId,
        rate,
        effective_month: Number(newMonth),
        effective_year: Number(newYear),
      });
      toast({ title: 'Rate history entry added' });
      const history = await getServiceRateHistory(clientId, historyServiceId);
      setRateHistory(history);
      setNewRate('');
      router.refresh();
    } catch (err: unknown) {
      toast({ title: 'Error', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setAddingEntry(false);
    }
  };

  const handleDeleteHistoryEntry = async (entryId: string) => {
    setDeletingId(entryId);
    try {
      await deleteServiceRateHistory(entryId);
      setRateHistory((prev) => prev.filter((h) => h.id !== entryId));
      toast({ title: 'Rate history entry removed' });
      router.refresh();
    } catch (err: unknown) {
      toast({ title: 'Error', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  if (services.length === 0) {
    return <p className="text-sm text-muted-foreground">No services assigned.</p>;
  }

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  const billingModelBadge = (model: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      CONTRACT: { label: 'Contract', className: 'bg-blue-100 text-blue-800 border-blue-200' },
      PROJECT: { label: 'Project', className: 'bg-purple-100 text-purple-800 border-purple-200' },
      RETAINER: { label: 'Retainer', className: 'bg-green-100 text-green-800 border-green-200' },
    };
    const v = variants[model] ?? { label: model, className: '' };
    return <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${v.className}`}>{v.label}</Badge>;
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      ACTIVE: { label: 'Active', className: 'bg-green-100 text-green-800 border-green-200' },
      COMPLETED: { label: 'Completed', className: 'bg-gray-100 text-gray-600 border-gray-200' },
      TERMINATED: { label: 'Terminated', className: 'bg-red-100 text-red-700 border-red-200' },
    };
    const v = variants[status] ?? { label: status, className: '' };
    return <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${v.className}`}>{v.label}</Badge>;
  };

  const formatPeriod = (m: number, y: number) => `${MONTH_NAMES[m - 1]} ${y}`;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Service</TableHead>
            <TableHead>Contract</TableHead>
            <TableHead>Standard Rate</TableHead>
            <TableHead>Client Rate ($/mo)</TableHead>
            <TableHead className="text-right">Effective</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((cs) => {
            const standardRate = Number(cs.service.standard_rate);
            const customRate = cs.custom_rate ? Number(cs.custom_rate) : null;
            const effectiveRate = customRate ?? standardRate;
            const serviceId = cs.service.id;
            const editKey = serviceId;
            const displayValue = editValues[editKey] ?? (customRate !== null ? String(customRate) : '');
            const serviceContracts = activeContractsByService.get(serviceId) ?? [];
            const activeContract = serviceContracts[0];

            return (
              <TableRow key={serviceId}>
                <TableCell className="font-medium">{cs.service.name}</TableCell>
                <TableCell>
                  {contractsLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  ) : activeContract ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        {billingModelBadge(activeContract.billing_model)}
                        {statusBadge(activeContract.status)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatPeriod(activeContract.start_month, activeContract.start_year)}
                        {activeContract.end_month && activeContract.end_year
                          ? ` - ${formatPeriod(activeContract.end_month, activeContract.end_year)}`
                          : ' - Ongoing'}
                      </p>
                      {activeContract.total_value && (
                        <p className="text-xs text-muted-foreground">
                          Total: {formatCurrency(activeContract.total_value)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">No contract</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatCurrency(standardRate)}/{cs.service.billing_type === 'one_time' ? 'once' : 'mo'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground text-sm">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={String(standardRate)}
                      value={displayValue}
                      onChange={(e) => setEditValues((prev) => ({ ...prev, [editKey]: e.target.value }))}
                      onBlur={(e) => handleSaveRate(serviceId, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      className="w-32 h-8 text-sm"
                      disabled={savingId === serviceId}
                    />
                    {savingId === serviceId && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(effectiveRate)}/mo
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {activeContract && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-orange-600"
                        title="End Contract"
                        onClick={() => openEndContract(activeContract.id)}
                      >
                        <StopCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-blue-600"
                      title="Rate History"
                      onClick={() => openRateHistory(serviceId, cs.service.name)}
                    >
                      <History className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-red-600"
                      onClick={() => handleRemove(serviceId, cs.service.name)}
                      disabled={removingId === serviceId}
                    >
                      {removingId === serviceId
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Historical Contracts Section */}
      {historicalContracts.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowHistorical(!showHistorical)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showHistorical ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {historicalContracts.length} historical contract{historicalContracts.length !== 1 ? 's' : ''}
          </button>
          {showHistorical && (
            <Table className="mt-2">
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historicalContracts.map((c) => (
                  <TableRow key={c.id} className="opacity-60">
                    <TableCell className="text-sm">{c.service.name}</TableCell>
                    <TableCell>{billingModelBadge(c.billing_model)}</TableCell>
                    <TableCell className="text-xs">
                      {formatPeriod(c.start_month, c.start_year)}
                      {c.end_month && c.end_year ? ` - ${formatPeriod(c.end_month, c.end_year)}` : ''}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.monthly_rate ? formatCurrency(c.monthly_rate) + '/mo' : ''}
                      {c.project_fee ? formatCurrency(c.project_fee) : ''}
                    </TableCell>
                    <TableCell>{statusBadge(c.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* End Contract Dialog */}
      <Dialog open={endContractOpen} onOpenChange={setEndContractOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>End Contract</DialogTitle>
            <DialogDescription>
              Set the termination date for this contract. The contract will be marked as terminated.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs">End Month</Label>
              <Select value={endMonth} onValueChange={setEndMonth}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End Year</Label>
              <Select value={endYear} onValueChange={setEndYear}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndContractOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleEndContract} disabled={isTerminating}>
              {isTerminating ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Terminating...</> : 'End Contract'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rate History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Rate History</DialogTitle>
            <DialogDescription>
              {historyServiceName} - Track rate changes over time. When refreshing ROI, each period uses the rate that was in effect at that time.
            </DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {rateHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Effective From</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rateHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm">
                          {MONTH_NAMES[entry.effectiveMonth - 1]} {entry.effectiveYear}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm">
                          {formatCurrency(entry.rate)}/mo
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-600"
                            onClick={() => handleDeleteHistoryEntry(entry.id)}
                            disabled={deletingId === entry.id}
                          >
                            {deletingId === entry.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <Trash2 className="h-3 w-3" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No rate history entries. Add one below to track when rates changed.
                </p>
              )}

              <div className="border rounded-lg p-3 space-y-3">
                <p className="text-sm font-medium">Add Rate Entry</p>
                <div className="flex items-end gap-2">
                  <div className="w-24">
                    <label className="text-xs text-muted-foreground block mb-1">Month</label>
                    <Select value={newMonth} onValueChange={setNewMonth}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTH_NAMES.map((name, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-20">
                    <label className="text-xs text-muted-foreground block mb-1">Year</label>
                    <Select value={newYear} onValueChange={setNewYear}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground block mb-1">Rate ($/mo)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newRate}
                      onChange={(e) => setNewRate(e.target.value)}
                      placeholder="0.00"
                      className="h-8 text-sm"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={handleAddHistoryEntry}
                    disabled={addingEntry || !newRate}
                    className="gap-1"
                  >
                    {addingEntry ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Add
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                After adding rate history, use &quot;Refresh All Periods&quot; on the financial summary to recalculate costs with the correct rates for each period.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
