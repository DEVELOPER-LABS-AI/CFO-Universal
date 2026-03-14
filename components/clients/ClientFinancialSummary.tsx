'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Wrench,
  Package,
  Layers,
  Building2,
  CircleDollarSign,
  Loader2,
  ChevronRight,
  Calendar,
  Info,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';
import { refreshClientROI } from '@/app/actions/roi-calculations';
import { useToast } from '@/hooks/use-toast';
import { EditAllocationsModal } from '@/components/clients/EditAllocationsModal';
import { getErrorMessage } from '@/lib/utils/error';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface CostBreakdown {
  bdr: number;
  contractor: number;
  subscription: number;
  service: number;
  agency: number;
  overhead: number;
  other: number;
}

interface StaffDetail {
  name: string;
  type: string;
  rate: number;
  rateType: string | null;
  allocation: number;
  startDate: string;
  endDate: string | null;
  status?: string;
  terminatedAt?: string | null;
}

interface ContractorDetail {
  name: string;
  rate: number;
  rateType: string | null;
  allocation: number;
  startDate: string;
  endDate: string | null;
}

interface SubscriptionDetail {
  name: string;
  monthlyCost: number;
  allocated: number;
  percentage: number;
}

interface ServiceDetail {
  id: string;
  name: string;
  category: string | null;
  standardRate: number;
  customRate: number | null;
  effectiveRate: number;
}

interface MercuryExpenseDetail {
  id: string;
  description: string | null;
  merchant: string | null;
  category: string;
  amount: number;
  date: string;
}

interface CostDetails {
  staff: StaffDetail[];
  contractors: ContractorDetail[];
  subscriptions: SubscriptionDetail[];
  services: ServiceDetail[];
  otherExpenses?: MercuryExpenseDetail[];
  subscriptionExpenses?: MercuryExpenseDetail[];
}

interface AllocationDetail {
  periodMonth: number;
  periodYear: number;
  serviceName: string | null;
  amount: number;
  description: string | null;
}

interface RevenueReceipt {
  id: string;
  amount: number;
  grossAmount: number | null;
  feeAmount: number;
  feePercentage: number | null;
  paymentMethod: string | null;
  date: string;
  period: string;
  description: string;
  allocations: AllocationDetail[];
}

interface RevenueDetails {
  receipts: RevenueReceipt[];
  total: number;
  count: number;
}

interface FinancialData {
  mode: 'month' | 'all';
  period: { month: number; year: number } | null;
  periodCount?: number;
  calculatedAt?: string;
  revenue: number;
  expectedRevenue?: number;
  variance?: number;
  variancePercentage?: number | null;
  totalCosts: number;
  profit: number;
  roiPercentage: number;
  marginPercentage: number;
  costBreakdown: CostBreakdown;
  costDetails: CostDetails;
  revenueDetails: RevenueDetails;
  availablePeriods: { month: number; year: number }[];
  needsRefresh?: boolean;
}

interface ClientFinancialSummaryProps {
  clientId: string;
  initialData?: {
    period: { month: number; year: number };
    calculatedAt: Date;
    revenue: number;
    totalCosts: number;
    profit: number;
    roiPercentage: number;
    marginPercentage: number;
    costBreakdown: CostBreakdown;
  } | null;
}

type DetailDialogType = 'revenue' | 'staff' | 'contractors' | 'subscriptions' | 'services' | 'other' | null;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Displays financial summary cards for a single client with period filtering
 * and clickable cost breakdown items showing detailed itemization.
 */
export function ClientFinancialSummary({ clientId, initialData }: ClientFinancialSummaryProps) {
  const now = new Date();
  const { toast } = useToast();
  const [mode, setMode] = useState<'month' | 'all'>('all');
  const [month, setMonth] = useState(initialData?.period.month ?? now.getMonth() + 1);
  const [year, setYear] = useState(initialData?.period.year ?? now.getFullYear());
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [detailDialog, setDetailDialog] = useState<DetailDialogType>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ mode });
      if (mode === 'month') {
        params.set('month', String(month));
        params.set('year', String(year));
      }
      const res = await fetch(`/api/clients/${clientId}/financial-summary?${params}`);
      if (!res.ok) throw new Error('Failed to load');
      const json: FinancialData = await res.json();
      setData(json);

      // On first load, if in month mode and no revenue for current period,
      // auto-select the most recent period that has deposits
      if (!hasAutoSelected && mode === 'month' && json.revenue === 0 && json.availablePeriods.length > 0) {
        const latest = json.availablePeriods[0];
        if (latest.month !== month || latest.year !== year) {
          setMonth(latest.month);
          setYear(latest.year);
        }
        setHasAutoSelected(true);
      } else if (!hasAutoSelected) {
        setHasAutoSelected(true);
      }
    } catch (err) {
      console.error('Failed to load financial summary:', err);
    } finally {
      setLoading(false);
    }
  }, [clientId, mode, month, year, hasAutoSelected]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** Refresh ROI for the currently selected period. */
  const handleRefreshCurrent = useCallback(async () => {
    if (mode !== 'month' || refreshing) return;
    setRefreshing(true);
    setRefreshProgress('Refreshing...');
    try {
      await refreshClientROI({ client_id: clientId, month, year });
      toast({ title: 'ROI refreshed', description: `${MONTH_NAMES[month - 1]} ${year} recalculated.` });
      await fetchData();
    } catch (err: unknown) {
      toast({ title: 'Refresh failed', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setRefreshing(false);
      setRefreshProgress('');
    }
  }, [clientId, month, year, mode, refreshing, fetchData, toast]);

  /** Refresh ROI for ALL available periods. */
  const handleRefreshAll = useCallback(async () => {
    if (refreshing || !data?.availablePeriods?.length) return;
    setRefreshing(true);
    const periods = data.availablePeriods;
    let done = 0;
    let failed = 0;
    for (const p of periods) {
      done++;
      setRefreshProgress(`Refreshing ${done}/${periods.length}...`);
      try {
        await refreshClientROI({ client_id: clientId, month: p.month, year: p.year });
      } catch (err) {
        console.error(`[RefreshROI] Failed for ${p.month}/${p.year}:`, err);
        failed++;
      }
    }
    setRefreshing(false);
    setRefreshProgress('');
    if (failed > 0) {
      toast({ title: 'Refresh complete', description: `${done - failed}/${periods.length} periods refreshed, ${failed} failed.`, variant: 'destructive' });
    } else {
      toast({ title: 'All periods refreshed', description: `${periods.length} period${periods.length !== 1 ? 's' : ''} recalculated.` });
    }
    await fetchData();
  }, [clientId, data?.availablePeriods, refreshing, fetchData, toast]);

  // Build year options
  const currentYear = now.getFullYear();
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear];

  if (loading && !data) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">Loading financial data...</span>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-sm text-muted-foreground text-center">
            No financial data available. Refresh ROI from the Portfolio dashboard to calculate.
          </p>
        </CardContent>
      </Card>
    );
  }

  const profitPositive = data.profit >= 0;
  const marginColor = data.marginPercentage >= 50
    ? 'text-green-600'
    : data.marginPercentage >= 20
      ? 'text-yellow-600'
      : 'text-red-600';

  const periodLabel = mode === 'all'
    ? `All Time (${data.periodCount ?? 0} periods)`
    : data.period
      ? `${MONTH_NAMES[data.period.month - 1]} ${data.period.year}`
      : 'N/A';

  // Cost breakdown items (show all, with zero values dimmed)
  // Services = what we charge the client (billing/revenue), Staff + Subscriptions = internal costs
  // Services (what we bill the client) is NOT an internal cost — excluded from cost breakdown
  const costItems: { key: DetailDialogType; label: string; sublabel?: string; value: number; icon: typeof DollarSign }[] = [
    { key: 'staff', label: 'Staff / BDR', sublabel: 'Internal cost', value: data.costBreakdown.bdr, icon: Users },
    { key: 'contractors', label: 'Contractors', sublabel: 'Internal cost', value: data.costBreakdown.contractor, icon: Wrench },
    { key: 'subscriptions', label: 'Subscriptions', sublabel: 'Internal cost', value: data.costBreakdown.subscription, icon: Package },
    { key: null, label: 'Agency', sublabel: 'Internal cost', value: data.costBreakdown.agency, icon: Building2 },
    { key: null, label: 'Overhead', sublabel: 'Allocated cost', value: data.costBreakdown.overhead, icon: CircleDollarSign },
    { key: 'other', label: 'Other', sublabel: 'Misc expenses', value: data.costBreakdown.other, icon: CircleDollarSign },
  ];

  const nonZeroCostItems = costItems.filter((item) => item.value > 0);

  return (
    <div className="space-y-4">
      {/* Header with period picker */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-semibold">Financial Summary</h3>

        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <Select value={mode} onValueChange={(v) => setMode(v as 'month' | 'all')}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>

          {/* Month/Year pickers (only in month mode) */}
          {mode === 'month' && (
            <>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, idx) => (
                    <SelectItem key={idx + 1} value={String(idx + 1)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

          {/* Refresh ROI dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={refreshing} className="gap-1.5">
                {refreshing
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                {refreshProgress || 'Refresh ROI'}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {mode === 'month' && (
                <DropdownMenuItem onClick={handleRefreshCurrent}>
                  Refresh {MONTH_NAMES[month - 1]} {year}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleRefreshAll}>
                Refresh All Periods ({data.availablePeriods?.length ?? 0})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Period context */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        <span>Period: {periodLabel}</span>
        {data.calculatedAt && (
          <span className="ml-2">
            (calculated {new Date(data.calculatedAt).toLocaleDateString()})
          </span>
        )}
        {data.needsRefresh && (
          <Button
            variant="link"
            size="sm"
            className="text-amber-600 h-auto p-0 ml-2"
            disabled={refreshing}
            onClick={handleRefreshCurrent}
          >
            Revenue data found - click to recalculate
          </Button>
        )}
      </div>

      {/* Key metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Revenue card - clickable */}
        <Card
          className="cursor-pointer hover:ring-2 hover:ring-green-200 transition-all"
          onClick={() => setDetailDialog('revenue')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(data.revenue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              {data.revenueDetails.count} Mercury deposit{data.revenueDetails.count !== 1 ? 's' : ''}
              <ChevronRight className="h-3 w-3" />
            </p>
          </CardContent>
        </Card>

        {/* Expected Revenue card */}
        {data.expectedRevenue !== undefined && data.expectedRevenue > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expected Revenue</CardTitle>
              <CircleDollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(data.expectedRevenue)}
              </div>
              {data.variance !== undefined && (
                <p className={`text-xs mt-1 font-medium ${
                  data.variance >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {data.variance >= 0 ? '+' : ''}{formatCurrency(data.variance)}
                  {data.variancePercentage != null && (
                    <span className="ml-1">
                      ({data.variancePercentage >= 0 ? '+' : ''}{data.variancePercentage.toFixed(1)}%)
                    </span>
                  )}
                  {' '}{data.variance >= 0 ? 'over' : 'under'}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Total Costs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.totalCosts)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {nonZeroCostItems.length} cost {nonZeroCostItems.length === 1 ? 'category' : 'categories'}
            </p>
          </CardContent>
        </Card>

        {/* Profit */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit</CardTitle>
            {profitPositive
              ? <TrendingUp className="h-4 w-4 text-green-600" />
              : <TrendingDown className="h-4 w-4 text-red-600" />
            }
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profitPositive ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.profit)}
            </div>
            <p className={`text-xs mt-1 ${marginColor}`}>
              {data.marginPercentage >= 0 ? '+' : ''}{data.marginPercentage.toFixed(1)}% margin
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cost breakdown - clickable items for drill-down */}
      {nonZeroCostItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Cost Breakdown</CardTitle>
            <CardDescription>
              Click a category for details
              {mode === 'month' && data.period
                ? ` - ${MONTH_NAMES[data.period.month - 1]} ${data.period.year}`
                : mode === 'all'
                  ? ` - all-time totals across ${data.periodCount ?? 0} periods`
                  : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {nonZeroCostItems.map((item) => {
                const Icon = item.icon;
                const percentage = data.totalCosts > 0
                  ? ((item.value / data.totalCosts) * 100).toFixed(0)
                  : '0';
                const clickable = item.key !== null;
                return (
                  <button
                    key={item.label}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left w-full ${
                      clickable
                        ? 'hover:bg-muted/50 hover:border-primary/30 transition-colors cursor-pointer'
                        : 'cursor-default'
                    }`}
                    onClick={() => clickable && setDetailDialog(item.key)}
                    disabled={!clickable}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        {item.sublabel && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            item.sublabel === 'Client billing'
                              ? 'bg-blue-50 text-blue-600 border border-blue-200'
                              : 'bg-gray-50 text-gray-500 border border-gray-200'
                          }`}>
                            {item.sublabel}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold">{formatCurrency(item.value)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">{percentage}%</span>
                      {clickable && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available periods quick-nav */}
      {data.availablePeriods.length > 0 && mode === 'month' && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Quick nav:</span>
          {data.availablePeriods.slice(0, 6).map((p) => {
            const isActive = p.month === month && p.year === year;
            return (
              <Button
                key={`${p.month}-${p.year}`}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setMonth(p.month); setYear(p.year); }}
              >
                {MONTH_NAMES[p.month - 1]} {p.year}
              </Button>
            );
          })}
        </div>
      )}

      {/* Detail dialogs */}
      <DetailDialog
        type={detailDialog}
        data={data}
        clientId={clientId}
        onClose={() => setDetailDialog(null)}
        onDataChanged={fetchData}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail Dialog
// ---------------------------------------------------------------------------

function DetailDialog({
  type,
  data,
  clientId,
  onClose,
  onDataChanged,
}: {
  type: DetailDialogType;
  data: FinancialData;
  clientId: string;
  onClose: () => void;
  onDataChanged: () => void;
}) {
  if (!type) return null;

  const config: Record<string, { title: string; description: string }> = {
    revenue: { title: 'Revenue Details', description: 'Mercury deposits linked to this client - actual cash received' },
    staff: { title: 'Staff / BDR Costs', description: 'Internal cost: Staff members assigned to this client and their allocated cost based on rate and allocation %' },
    contractors: { title: 'Contractor Costs', description: 'Internal cost: Contractors assigned to this client and their allocated cost' },
    subscriptions: { title: 'Subscription Costs', description: 'Internal cost: Software/tool subscriptions allocated to this client' },
    services: { title: 'Service Charges', description: 'What you charge the client for services provided - these rates represent your billing to the customer' },
    other: { title: 'Other Expenses', description: 'Mercury expenses categorized as Payroll, Overhead, Marketing, or Other that are linked to this client\'s entities' },
  };

  const { title, description } = config[type] ?? { title: 'Details', description: '' };

  const clientServices = data.costDetails.services.map((s) => ({ id: s.id, name: s.name }));

  return (
    <Dialog open={!!type} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {type === 'revenue' && (
          <RevenueDetailTable
            data={data.revenueDetails}
            clientId={clientId}
            clientServices={clientServices}
            onDataChanged={onDataChanged}
          />
        )}
        {type === 'staff' && <StaffDetailTable data={data.costDetails.staff} />}
        {type === 'contractors' && <ContractorDetailTable data={data.costDetails.contractors} />}
        {type === 'subscriptions' && <SubscriptionDetailTable data={data.costDetails.subscriptions} />}
        {type === 'services' && <ServiceDetailTable data={data.costDetails.services} />}
        {type === 'other' && <OtherExpensesDetailTable data={data.costDetails.otherExpenses ?? []} />}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Detail Tables
// ---------------------------------------------------------------------------

function RevenueDetailTable({
  data,
  clientId,
  clientServices,
  onDataChanged,
}: {
  data: RevenueDetails;
  clientId: string;
  clientServices: { id: string; name: string }[];
  onDataChanged: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<RevenueReceipt | null>(null);

  if (data.receipts.length === 0) {
    return (
      <div className="py-6 text-center">
        <Info className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No Mercury deposits linked for this period.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Link deposits from the Mercury Deposits section below.
        </p>
      </div>
    );
  }

  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="space-y-3">
      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
        <p className="text-sm text-green-700">
          Total: <span className="font-bold">{formatCurrency(data.total)}</span> from {data.count} deposit{data.count !== 1 ? 's' : ''}
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Period</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.receipts.map((r) => {
            const hasDetails = r.allocations.length > 1 || r.feeAmount > 0;
            const isExpanded = expandedId === r.id;
            return (
              <React.Fragment key={r.id}>
                <TableRow
                  className="hover:bg-muted/50"
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                >
                  <TableCell className="text-sm">{new Date(r.date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1.5">
                      {r.description}
                      {r.paymentMethod && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border">
                          {r.paymentMethod.replace('_', ' ')}
                        </span>
                      )}
                      {(hasDetails || true) && (
                        <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.period}</TableCell>
                  <TableCell className="text-right font-medium text-green-600">
                    +{formatCurrency(r.amount)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={(e) => { e.stopPropagation(); setEditingReceipt(r); }}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <>
                    {r.feeAmount > 0 && (
                      <TableRow className="bg-muted/30">
                        <TableCell />
                        <TableCell colSpan={2} className="text-xs text-muted-foreground">
                          Fee: {r.feePercentage ? `${(r.feePercentage * 100).toFixed(1)}%` : ''} ({r.paymentMethod?.replace('_', ' ') || 'Unknown'})
                          {r.grossAmount && ` | Gross: ${formatCurrency(r.grossAmount)}`}
                        </TableCell>
                        <TableCell className="text-right text-xs text-red-500">
                          -{formatCurrency(r.feeAmount)}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                    {r.allocations.map((a, idx) => (
                      <TableRow key={idx} className="bg-muted/30">
                        <TableCell />
                        <TableCell className="text-xs text-muted-foreground pl-6">
                          {a.serviceName || a.description || 'Allocated'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {MONTH_LABELS[a.periodMonth - 1]} {a.periodYear}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          {formatCurrency(a.amount)}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    ))}
                  </>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>

      {/* Edit Allocations Modal */}
      {editingReceipt && (
        <EditAllocationsModal
          open={!!editingReceipt}
          onOpenChange={(open) => { if (!open) setEditingReceipt(null); }}
          receipt={{
            id: editingReceipt.id,
            amount: editingReceipt.amount,
            date: editingReceipt.date,
            description: editingReceipt.description,
          }}
          existingAllocations={editingReceipt.allocations}
          clientId={clientId}
          clientServices={clientServices}
          onSaved={onDataChanged}
        />
      )}
    </div>
  );
}

function StaffDetailTable({ data }: { data: StaffDetail[] }) {
  if (data.length === 0) {
    return <EmptyDetail message="No staff assignments for this period." />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Rate</TableHead>
          <TableHead>Allocation</TableHead>
          <TableHead>Period</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((s, i) => {
          const isTerminated = s.status === 'TERMINATED';
          return (
            <TableRow key={i} className={isTerminated ? 'opacity-60' : ''}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-1.5">
                  {s.name}
                  {isTerminated && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                      Terminated
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{s.type}</TableCell>
              <TableCell className="text-sm">
                {formatCurrency(s.rate)}/{(s.rateType ?? 'MONTHLY').toLowerCase().slice(0, 2)}
              </TableCell>
              <TableCell className="text-sm">{s.allocation}%</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(s.startDate).toLocaleDateString()} - {s.endDate ? new Date(s.endDate).toLocaleDateString() : 'Present'}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ContractorDetailTable({ data }: { data: ContractorDetail[] }) {
  if (data.length === 0) {
    return <EmptyDetail message="No contractor assignments for this period." />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Rate</TableHead>
          <TableHead>Allocation</TableHead>
          <TableHead>Period</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((c, i) => (
          <TableRow key={i}>
            <TableCell className="font-medium">{c.name}</TableCell>
            <TableCell className="text-sm">
              {formatCurrency(c.rate)}/{(c.rateType ?? 'MONTHLY').toLowerCase().slice(0, 2)}
            </TableCell>
            <TableCell className="text-sm">{c.allocation}%</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {new Date(c.startDate).toLocaleDateString()} - {c.endDate ? new Date(c.endDate).toLocaleDateString() : 'Present'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SubscriptionDetailTable({ data }: { data: SubscriptionDetail[] }) {
  if (data.length === 0) {
    return <EmptyDetail message="No subscriptions allocated to this client." />;
  }

  const total = data.reduce((sum, s) => sum + s.allocated, 0);

  return (
    <div className="space-y-3">
      <div className="p-3 bg-muted rounded-lg">
        <p className="text-sm">
          Total allocated: <span className="font-bold">{formatCurrency(total)}</span>/mo
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Subscription</TableHead>
            <TableHead>Monthly Cost</TableHead>
            <TableHead>Allocation</TableHead>
            <TableHead className="text-right">Client Cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((s, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell className="text-sm">{formatCurrency(s.monthlyCost)}</TableCell>
              <TableCell className="text-sm">{s.percentage}%</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(s.allocated)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ServiceDetailTable({ data }: { data: ServiceDetail[] }) {
  if (data.length === 0) {
    return <EmptyDetail message="No services assigned to this client." />;
  }

  const total = data.reduce((sum, s) => sum + s.effectiveRate, 0);

  return (
    <div className="space-y-3">
      <div className="p-3 bg-muted rounded-lg">
        <p className="text-sm">
          Total: <span className="font-bold">{formatCurrency(total)}</span>/mo
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Service</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Standard Rate</TableHead>
            <TableHead className="text-right">Client Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((s, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{s.category ?? '-'}</TableCell>
              <TableCell className="text-sm">{formatCurrency(s.standardRate)}</TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(s.effectiveRate)}
                {s.customRate !== null && (
                  <span className="text-xs text-amber-600 ml-1">(custom)</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function OtherExpensesDetailTable({ data }: { data: MercuryExpenseDetail[] }) {
  if (data.length === 0) {
    return <EmptyDetail message="No other Mercury expenses found for this period." />;
  }

  const total = data.reduce((sum, e) => sum + e.amount, 0);

  // Group by category
  const byCategory = new Map<string, number>();
  for (const e of data) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  }

  return (
    <div className="space-y-3">
      <div className="p-3 bg-muted rounded-lg space-y-1">
        <p className="text-sm">
          Total: <span className="font-bold">{formatCurrency(total)}</span>
        </p>
        <div className="flex gap-3 flex-wrap">
          {Array.from(byCategory.entries()).map(([cat, amount]) => (
            <span key={cat} className="text-xs text-muted-foreground">
              {cat}: {formatCurrency(amount)}
            </span>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        These are Mercury bank expenses categorized as Payroll, Overhead, Marketing, or Other that are linked to this client through direct assignment or contractor/agency relationships.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="text-sm">{new Date(e.date).toLocaleDateString()}</TableCell>
              <TableCell className="text-sm">{e.description || e.merchant || 'Unknown'}</TableCell>
              <TableCell>
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 border">
                  {e.category}
                </span>
              </TableCell>
              <TableCell className="text-right font-medium text-sm">
                {formatCurrency(e.amount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EmptyDetail({ message }: { message: string }) {
  return (
    <div className="py-6 text-center">
      <Info className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
