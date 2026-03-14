'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw, CheckCircle2, XCircle, Clock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getRecommendations } from '@/app/actions/cfo-strategist';
import { ActOnModal } from '@/components/cfo-strategist/ActOnModal';
import { DismissModal } from '@/components/cfo-strategist/DismissModal';
import { DeferModal } from '@/components/cfo-strategist/DeferModal';
import { formatCurrency } from '@/lib/utils/currency';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

/** Category enum to human label. */
const CATEGORY_LABELS: Record<string, string> = {
  SUBSCRIPTION_OPTIMIZATION: 'Subscription',
  STAFFING_EFFICIENCY: 'Staffing',
  REVENUE_OPPORTUNITY: 'Revenue',
  OVERHEAD_REDUCTION: 'Overhead',
};

/** Category badge color map. */
const CATEGORY_COLORS: Record<string, string> = {
  SUBSCRIPTION_OPTIMIZATION: 'bg-violet-100 text-violet-700 hover:bg-violet-100',
  STAFFING_EFFICIENCY: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  REVENUE_OPPORTUNITY: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  OVERHEAD_REDUCTION: 'bg-red-100 text-red-700 hover:bg-red-100',
};

/** Status badge styling. */
const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  ACTED_ON: 'bg-green-100 text-green-700 hover:bg-green-100',
  DISMISSED: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
  DEFERRED: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
};

/** Confidence level display. */
function getConfidenceDisplay(level: number): { label: string; className: string } {
  if (level >= 0.7) return { label: 'High', className: 'bg-green-100 text-green-700 hover:bg-green-100' };
  if (level >= 0.4) return { label: 'Medium', className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' };
  return { label: 'Low', className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' };
}

type Recommendation = Awaited<ReturnType<typeof getRecommendations>>[number];

export default function RecommendationsPage() {
  const [data, setData] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal state
  const [actModal, setActModal] = useState<{ open: boolean; rec: Recommendation | null }>({
    open: false,
    rec: null,
  });
  const [dismissModal, setDismissModal] = useState<{ open: boolean; rec: Recommendation | null }>({
    open: false,
    rec: null,
  });
  const [deferModal, setDeferModal] = useState<{ open: boolean; rec: Recommendation | null }>({
    open: false,
    rec: null,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const filters: { category?: string; status?: string } = {};
      if (categoryFilter !== 'all') filters.category = categoryFilter;
      if (statusFilter !== 'all') filters.status = statusFilter;
      const result = await getRecommendations(filters);
      setData(result);
    } catch (error: unknown) {
      console.error('Failed to fetch recommendations:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSuccess = () => {
    fetchData();
  };

  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/strategist">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Recommendations</h1>
            <p className="text-muted-foreground">
              Review and manage optimization recommendations
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-4">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="SUBSCRIPTION_OPTIMIZATION">Subscription</SelectItem>
            <SelectItem value="STAFFING_EFFICIENCY">Staffing</SelectItem>
            <SelectItem value="REVENUE_OPPORTUNITY">Revenue</SelectItem>
            <SelectItem value="OVERHEAD_REDUCTION">Overhead</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="ACTED_ON">Acted On</SelectItem>
            <SelectItem value="DISMISSED">Dismissed</SelectItem>
            <SelectItem value="DEFERRED">Deferred</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground">
          {data.length} recommendation{data.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Recommendations List */}
      {data.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">No recommendations match your filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {data.map((rec) => {
            const confidence = getConfidenceDisplay(rec.confidenceLevel);
            const categoryColor = CATEGORY_COLORS[rec.category] ?? 'bg-gray-100 text-gray-700';
            const statusStyle = STATUS_STYLES[rec.status] ?? 'bg-gray-100 text-gray-700';

            return (
              <Card key={rec.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      {/* Title + entity name */}
                      <div>
                        <h3 className="font-semibold text-sm">{rec.title}</h3>
                        {rec.targetEntityName && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {rec.targetEntityType}: {rec.targetEntityName}
                          </p>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground">{rec.description}</p>

                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge className={categoryColor}>
                          {CATEGORY_LABELS[rec.category] ?? rec.category}
                        </Badge>
                        <Badge className={statusStyle}>{rec.status.replace('_', ' ')}</Badge>
                        <Badge className={confidence.className}>{confidence.label}</Badge>
                        {rec.hasTradeOff && (
                          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100" title={
                            rec.conflictingCategories
                              ? `Also appears in: ${rec.conflictingCategories.join(', ')}`
                              : 'This recommendation may conflict with another'
                          }>
                            Trade-off
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Right side: impact + actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-lg font-bold text-green-700">
                        {formatCurrency(rec.estimatedMonthlyImpact)}/mo
                      </span>

                      {rec.status === 'ACTIVE' && (
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-700 border-green-300 hover:bg-green-50"
                            onClick={() => setActModal({ open: true, rec })}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Act On
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-gray-700 border-gray-300 hover:bg-gray-50"
                            onClick={() => setDismissModal({ open: true, rec })}
                          >
                            <XCircle className="mr-1 h-3 w-3" />
                            Dismiss
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-yellow-700 border-yellow-300 hover:bg-yellow-50"
                            onClick={() => setDeferModal({ open: true, rec })}
                          >
                            <Clock className="mr-1 h-3 w-3" />
                            Defer
                          </Button>
                        </div>
                      )}

                      {rec.status === 'ACTED_ON' && rec.actedOnAt && (
                        <span className="text-xs text-muted-foreground">
                          Acted on {new Date(rec.actedOnAt).toLocaleDateString()}
                        </span>
                      )}

                      {rec.status === 'DEFERRED' && rec.deferredUntil && (
                        <span className="text-xs text-muted-foreground">
                          Deferred until {new Date(rec.deferredUntil).toLocaleDateString()}
                        </span>
                      )}

                      {rec.status === 'DISMISSED' && rec.dismissedReason && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={rec.dismissedReason}>
                          Reason: {rec.dismissedReason}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {actModal.rec && (
        <ActOnModal
          recommendationId={actModal.rec.id}
          recommendationTitle={actModal.rec.title}
          estimatedImpact={actModal.rec.estimatedMonthlyImpact}
          open={actModal.open}
          onOpenChange={(open) => setActModal({ ...actModal, open })}
          onSuccess={handleSuccess}
        />
      )}
      {dismissModal.rec && (
        <DismissModal
          recommendationId={dismissModal.rec.id}
          recommendationTitle={dismissModal.rec.title}
          open={dismissModal.open}
          onOpenChange={(open) => setDismissModal({ ...dismissModal, open })}
          onSuccess={handleSuccess}
        />
      )}
      {deferModal.rec && (
        <DeferModal
          recommendationId={deferModal.rec.id}
          recommendationTitle={deferModal.rec.title}
          open={deferModal.open}
          onOpenChange={(open) => setDeferModal({ ...deferModal, open })}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
