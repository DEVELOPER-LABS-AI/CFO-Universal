'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, AlertTriangle, ShieldAlert, ShieldOff } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type CoverageStatus = 'COVERED' | 'WARNING' | 'PAST_DUE' | 'SUSPENDED';

interface CoverageData {
  monthlyServiceCost: number;
  totalPaid: number;
  totalExpected: number;
  coveredThrough: { month: number; year: number } | null;
  monthsRemaining: number;
  creditBalance: number;
  status: CoverageStatus;
  daysUntilShutoff: number | null;
  gracePeriodDays: number;
  warningDays: number;
}

const STATUS_CONFIG: Record<CoverageStatus, {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: typeof ShieldCheck;
  color: string;
  bgColor: string;
}> = {
  COVERED: {
    label: 'Covered',
    variant: 'default',
    icon: ShieldCheck,
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200',
  },
  WARNING: {
    label: 'Coverage Ending',
    variant: 'outline',
    icon: AlertTriangle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 border-amber-200',
  },
  PAST_DUE: {
    label: 'Past Due',
    variant: 'destructive',
    icon: ShieldAlert,
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
  },
  SUSPENDED: {
    label: 'Suspended',
    variant: 'destructive',
    icon: ShieldOff,
    color: 'text-red-700',
    bgColor: 'bg-red-100 border-red-300',
  },
};

/**
 * Displays service coverage status on the client detail page.
 * Shows whether the client is covered, how many months remain, and credit balance.
 */
export function ServiceCoverageCard({ clientId }: { clientId: string }) {
  const [data, setData] = useState<CoverageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/clients/${clientId}/service-coverage`);
        if (!res.ok) throw new Error('Failed to load');
        setData(await res.json());
      } catch {
        // Silently fail -- card just won't show
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [clientId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">Checking service coverage...</span>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.monthlyServiceCost <= 0) {
    return null; // No services assigned, don't show card
  }

  const config = STATUS_CONFIG[data.status];
  const Icon = config.icon;

  return (
    <Card className={`border ${config.bgColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${config.color}`} />
            <CardTitle className="text-base">Service Coverage</CardTitle>
          </div>
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>
        <CardDescription>
          Monthly rate: {formatCurrency(data.monthlyServiceCost)}/mo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Covered through */}
          <div>
            <p className="text-xs text-muted-foreground">Covered Through</p>
            <p className="text-sm font-semibold">
              {data.coveredThrough
                ? `${MONTH_NAMES[data.coveredThrough.month - 1]} ${data.coveredThrough.year}`
                : 'No coverage'}
            </p>
          </div>

          {/* Months remaining */}
          <div>
            <p className="text-xs text-muted-foreground">Prepaid Months Left</p>
            <p className="text-sm font-semibold">
              {data.monthsRemaining > 0
                ? `${data.monthsRemaining} month${data.monthsRemaining !== 1 ? 's' : ''}`
                : 'None'}
            </p>
          </div>

          {/* Credit balance */}
          <div>
            <p className="text-xs text-muted-foreground">Credit Balance</p>
            <p className={`text-sm font-semibold ${data.creditBalance > 0 ? 'text-green-600' : ''}`}>
              {formatCurrency(data.creditBalance)}
            </p>
          </div>
        </div>

        {/* Warning / action messages */}
        {data.status === 'WARNING' && data.daysUntilShutoff !== null && (
          <div className="mt-3 p-2 rounded bg-amber-100 border border-amber-300 text-sm text-amber-800">
            Service will be suspended in {data.daysUntilShutoff} days if no payment is received.
          </div>
        )}

        {data.status === 'PAST_DUE' && data.daysUntilShutoff !== null && (
          <div className="mt-3 p-2 rounded bg-red-100 border border-red-300 text-sm text-red-800">
            Coverage has ended. {data.daysUntilShutoff > 0
              ? `Grace period: ${data.daysUntilShutoff} days remaining before suspension.`
              : 'Grace period has expired.'}
          </div>
        )}

        {data.status === 'SUSPENDED' && (
          <div className="mt-3 p-2 rounded bg-red-200 border border-red-400 text-sm text-red-900 font-medium">
            Service should be stopped. Grace period ({data.gracePeriodDays} days) has expired with no payment.
          </div>
        )}

        {/* Payment summary */}
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <span>Total paid: {formatCurrency(data.totalPaid)}</span>
          <span>Total expected: {formatCurrency(data.totalExpected)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
