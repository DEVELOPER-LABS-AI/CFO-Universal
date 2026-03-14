'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ClientROITable } from '@/components/portfolio/ClientROITable';
import { PortfolioSummaryCards } from '@/components/portfolio/PortfolioSummaryCards';
import { ExportButton } from '@/components/portfolio/ExportButton';
import { RefreshCw, Search } from 'lucide-react';
import { getClientROIDashboard, refreshAllClientROI } from '@/app/actions/roi-calculations';
import { getOrganizationSettings } from '@/app/actions/organization-settings';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/use-debounce';
import { getErrorMessage } from '@/lib/utils/error';

// T132: Portfolio dashboard page
// T135: Client search with debounced input
// T136: Filters - status dropdown, relationship dropdown, margin range sliders
// T137: "Refresh ROI" button triggering refreshClientROI for all clients

export default function PortfolioDashboardPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [includeOwnerPay, setIncludeOwnerPay] = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [relationshipFilter, setRelationshipFilter] = useState<string>('');
  const [minMargin, setMinMargin] = useState<number | undefined>(undefined);
  const [maxMargin, setMaxMargin] = useState<number | undefined>(undefined);
  const [minROI, setMinROI] = useState<number | undefined>(undefined);
  const [maxROI, setMaxROI] = useState<number | undefined>(undefined);

  // T135: Debounced search
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Load org default for owner pay on mount
  useEffect(() => {
    getOrganizationSettings().then((s) => setIncludeOwnerPay(s.includeOwnerPay));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const filters: any = {};

      if (statusFilter) filters.status = statusFilter;
      if (relationshipFilter) filters.relationship_type = relationshipFilter;
      if (minMargin !== undefined) filters.min_margin = minMargin;
      if (maxMargin !== undefined) filters.max_margin = maxMargin;
      if (minROI !== undefined) filters.min_roi = minROI;
      if (maxROI !== undefined) filters.max_roi = maxROI;
      if (debouncedSearch) filters.search = debouncedSearch;

      const data = await getClientROIDashboard(filters);
      setClients(data.clients);
      setSummary(data.summary);
    } catch (error: unknown) {
      console.error('Failed to fetch client ROI data:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, relationshipFilter, minMargin, maxMargin, minROI, maxROI, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // T137: Refresh ROI for all clients
  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      toast.info(`Refreshing ROI for ${clients.length} clients...`);

      const result = await refreshAllClientROI(month, year, includeOwnerPay);

      if (result.successful > 0) {
        toast.success(`Successfully refreshed ROI for ${result.successful} clients`);
      }

      if (result.failed > 0) {
        toast.warning(`Failed to refresh ${result.failed} clients`);
      }

      // Refresh the table data
      await fetchData();
    } catch (error: unknown) {
      console.error('Failed to refresh client ROI:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setRefreshing(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setRelationshipFilter('');
    setMinMargin(undefined);
    setMaxMargin(undefined);
    setMinROI(undefined);
    setMaxROI(undefined);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portfolio Dashboard</h1>
          <p className="text-muted-foreground">
            Client profitability analysis and ROI metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="owner-pay-toggle"
              checked={includeOwnerPay}
              onCheckedChange={(checked) => setIncludeOwnerPay(checked === true)}
            />
            <Label htmlFor="owner-pay-toggle" className="text-sm cursor-pointer whitespace-nowrap">
              Include Owner Pay
            </Label>
          </div>
          <Button
            onClick={handleRefreshAll}
            disabled={refreshing || loading}
            variant="outline"
          >
            {refreshing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh ROI
              </>
            )}
          </Button>
          <ExportButton
            filters={{
              status: statusFilter,
              relationship_type: relationshipFilter,
              min_margin: minMargin,
              max_margin: maxMargin,
              min_roi: minROI,
              max_roi: maxROI,
              search: debouncedSearch,
            }}
          />
        </div>
      </div>

      {/* Summary Cards */}
      {summary && <PortfolioSummaryCards summary={summary} />}

      {/* Filters */}
      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Filters</h3>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear All
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Search Clients</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
              <SelectTrigger id="status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="CHURNED">Churned</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Relationship Filter */}
          <div className="space-y-2">
            <Label htmlFor="relationship">Relationship Type</Label>
            <Select value={relationshipFilter || 'all'} onValueChange={(v) => setRelationshipFilter(v === 'all' ? '' : v)}>
              <SelectTrigger id="relationship">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="RETAINER">Retainer</SelectItem>
                <SelectItem value="PROJECT_BASED">Project-Based</SelectItem>
                <SelectItem value="HOURLY">Hourly</SelectItem>
                <SelectItem value="VALUE_BASED">Value-Based</SelectItem>
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Margin Range */}
          <div className="space-y-2">
            <Label>Margin % Range</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={minMargin ?? ''}
                onChange={(e) => setMinMargin(e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full"
              />
              <Input
                type="number"
                placeholder="Max"
                value={maxMargin ?? ''}
                onChange={(e) => setMaxMargin(e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full"
              />
            </div>
          </div>

          {/* ROI Range */}
          <div className="space-y-2">
            <Label>ROI % Range</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={minROI ?? ''}
                onChange={(e) => setMinROI(e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full"
              />
              <Input
                type="number"
                placeholder="Max"
                value={maxROI ?? ''}
                onChange={(e) => setMaxROI(e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Client ROI Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ClientROITable clients={clients} />
      )}
    </div>
  );
}
