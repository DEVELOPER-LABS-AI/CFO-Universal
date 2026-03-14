'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BonusTierBreakdown } from './BonusTierBreakdown';
import { saveBDRReport, submitBDRReport } from '@/app/actions/bdr-portal-actions';
import { calculateTieredBonus, type BonusTier } from '@/lib/calculations/bdr-bonus';
import { toast } from 'sonner';
import { AlertCircle, Send, Save } from 'lucide-react';

interface PayPlanData {
  id: string;
  name: string;
  baseMetric: string;
  tiers: { minThreshold: number; maxThreshold: number | null; payoutRate: number; sortOrder: number }[];
}

interface ReportData {
  id: string;
  month: number;
  year: number;
  meetingsBooked: number;
  meetingsShowed: number;
  calculatedBonus: number;
  bonusBreakdown: any[];
  status: string;
  notes: string | null;
  adminNotes: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
}

interface MonthlyReportFormProps {
  month: number;
  year: number;
  report: ReportData | null;
  payPlan: PayPlanData | null;
  onSaved: () => void;
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  SUBMITTED: { label: 'Submitted', variant: 'default' },
  APPROVED: { label: 'Approved', variant: 'default' },
  NEEDS_CORRECTION: { label: 'Needs Correction', variant: 'destructive' },
};

/**
 * Form for BDR to enter monthly meetings and see auto-calculated bonus.
 */
export function MonthlyReportForm({ month, year, report, payPlan, onSaved }: MonthlyReportFormProps) {
  const [meetingsBooked, setMeetingsBooked] = useState(report?.meetingsBooked ?? 0);
  const [meetingsShowed, setMeetingsShowed] = useState(report?.meetingsShowed ?? 0);
  const [notes, setNotes] = useState(report?.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportId, setReportId] = useState(report?.id ?? null);
  const [status, setStatus] = useState(report?.status ?? null);

  // Calculate bonus in real-time
  const [bonusResult, setBonusResult] = useState<{ total: number; breakdown: any[] }>({
    total: report?.calculatedBonus ?? 0,
    breakdown: report?.bonusBreakdown ?? [],
  });

  useEffect(() => {
    if (!payPlan) {
      setBonusResult({ total: 0, breakdown: [] });
      return;
    }
    const tiers: BonusTier[] = payPlan.tiers.map((t) => ({
      minThreshold: t.minThreshold,
      maxThreshold: t.maxThreshold,
      payoutRate: t.payoutRate,
      sortOrder: t.sortOrder,
    }));
    const metricValue = payPlan.baseMetric === 'MEETINGS_SHOWED' ? meetingsShowed : meetingsBooked;
    setBonusResult(calculateTieredBonus(metricValue, tiers));
  }, [meetingsBooked, meetingsShowed, payPlan]);

  const canEdit = !status || status === 'DRAFT' || status === 'NEEDS_CORRECTION';
  const canSubmit = reportId && canEdit;

  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });

  const handleSave = async () => {
    setIsSaving(true);
    const result = await saveBDRReport({
      month,
      year,
      meetings_booked: meetingsBooked,
      meetings_showed: meetingsShowed,
      notes: notes || undefined,
    });

    if (result.success) {
      setReportId(result.data.id);
      setStatus(result.data.status);
      toast.success('Report saved as draft');
      onSaved();
    } else {
      toast.error(result.error);
    }
    setIsSaving(false);
  };

  const handleSubmit = async () => {
    if (!reportId) return;
    setIsSubmitting(true);

    const result = await submitBDRReport({ report_id: reportId });

    if (result.success) {
      setStatus('SUBMITTED');
      toast.success('Report submitted for review');
      onSaved();
    } else {
      toast.error(result.error);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {monthName} {year} Report
              </CardTitle>
              <CardDescription>
                {payPlan
                  ? `Pay Plan: ${payPlan.name} (${payPlan.baseMetric === 'MEETINGS_SHOWED' ? 'Meetings Showed' : 'Meetings Booked'})`
                  : 'No pay plan assigned — contact your admin'}
              </CardDescription>
            </div>
            {status && (
              <Badge variant={STATUS_LABELS[status]?.variant ?? 'secondary'}>
                {STATUS_LABELS[status]?.label ?? status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Admin feedback for NEEDS_CORRECTION */}
          {status === 'NEEDS_CORRECTION' && report?.adminNotes && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Admin feedback:</strong> {report.adminNotes}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="meetingsBooked">Meetings Booked</Label>
              <Input
                id="meetingsBooked"
                type="number"
                min={0}
                value={meetingsBooked}
                onChange={(e) => setMeetingsBooked(parseInt(e.target.value) || 0)}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meetingsShowed">Meetings Showed</Label>
              <Input
                id="meetingsShowed"
                type="number"
                min={0}
                value={meetingsShowed}
                onChange={(e) => setMeetingsShowed(parseInt(e.target.value) || 0)}
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this month..."
              rows={3}
              maxLength={1000}
              disabled={!canEdit}
            />
          </div>

          {canEdit && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Draft'}
              </Button>
              {canSubmit && (
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  <Send className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Submitting...' : 'Submit Report'}
                </Button>
              )}
            </div>
          )}

          {status === 'APPROVED' && report?.approvedAt && (
            <p className="text-sm text-muted-foreground">
              Approved on {new Date(report.approvedAt).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>

      <BonusTierBreakdown breakdown={bonusResult.breakdown} totalBonus={bonusResult.total} />
    </div>
  );
}
