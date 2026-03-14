'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { approveReport, flagReportForCorrection } from '@/app/actions/bdr-admin-actions';
import { toast } from 'sonner';
import { CheckCircle, AlertTriangle } from 'lucide-react';

interface ReportData {
  id: string;
  staffId: string;
  staffName: string;
  month: number;
  year: number;
  meetingsBooked: number;
  meetingsShowed: number;
  calculatedBonus: number;
  bonusBreakdown: { tierName: string; meetingsInRange: number; rate: number; subtotal: number }[];
  status: string;
  notes: string | null;
  adminNotes: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  payPlanName: string | null;
  baseMetric: string | null;
}

interface ReportReviewCardProps {
  report: ReportData;
  onAction: () => void;
}

/** Formats a number as a dollar amount with 2 decimal places. */
function formatDollars(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** Returns the appropriate Badge variant for a given report status. */
function getStatusVariant(status: string): 'default' | 'destructive' | 'secondary' {
  switch (status) {
    case 'APPROVED':
      return 'secondary';
    case 'NEEDS_CORRECTION':
      return 'destructive';
    case 'SUBMITTED':
    default:
      return 'default';
  }
}

/** Returns a human-readable label for a report status. */
function getStatusLabel(status: string): string {
  switch (status) {
    case 'SUBMITTED':
      return 'Submitted';
    case 'APPROVED':
      return 'Approved';
    case 'NEEDS_CORRECTION':
      return 'Needs Correction';
    default:
      return status;
  }
}

/**
 * Admin review card for a single BDR monthly report.
 * Displays report details, bonus breakdown, and provides
 * approve/flag actions for SUBMITTED reports.
 */
export function ReportReviewCard({ report, onAction }: ReportReviewCardProps) {
  const [adminNotes, setAdminNotes] = useState(report.adminNotes ?? '');
  const [notesError, setNotesError] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isFlagging, setIsFlagging] = useState(false);

  const isSubmitted = report.status === 'SUBMITTED';
  const isLoading = isApproving || isFlagging;

  /** Approves the report with optional admin notes. */
  async function handleApprove() {
    setNotesError('');
    setIsApproving(true);

    try {
      const result = await approveReport({
        report_id: report.id,
        admin_notes: adminNotes.trim() || undefined,
      });

      if (result.success) {
        toast.success(`Report for ${report.staffName} approved`);
        onAction();
      } else {
        toast.error(result.error ?? 'Failed to approve report');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsApproving(false);
    }
  }

  /** Flags the report for correction. Admin notes are required. */
  async function handleFlag() {
    setNotesError('');

    if (!adminNotes.trim()) {
      setNotesError('Admin notes are required when flagging for correction.');
      return;
    }

    setIsFlagging(true);

    try {
      const result = await flagReportForCorrection({
        report_id: report.id,
        admin_notes: adminNotes.trim(),
      });

      if (result.success) {
        toast.success(`Report for ${report.staffName} flagged for correction`);
        onAction();
      } else {
        toast.error(result.error ?? 'Failed to flag report');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsFlagging(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{report.staffName}</CardTitle>
          <Badge
            variant={getStatusVariant(report.status)}
            className={
              report.status === 'APPROVED'
                ? 'bg-green-100 text-green-800 hover:bg-green-100/80 border-green-200'
                : report.status === 'SUBMITTED'
                  ? 'bg-blue-100 text-blue-800 hover:bg-blue-100/80 border-blue-200'
                  : undefined
            }
          >
            {getStatusLabel(report.status)}
          </Badge>
        </div>
        {report.payPlanName && (
          <p className="text-sm text-muted-foreground">Pay Plan: {report.payPlanName}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Meeting Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Meetings Booked</p>
            <p className="text-xl font-semibold">{report.meetingsBooked}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Meetings Showed</p>
            <p className="text-xl font-semibold">{report.meetingsShowed}</p>
          </div>
        </div>

        {/* Bonus Breakdown Table */}
        {report.bonusBreakdown.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Bonus Breakdown</p>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium">Tier</th>
                    <th className="text-right px-3 py-2 font-medium">Meetings</th>
                    <th className="text-right px-3 py-2 font-medium">Rate</th>
                    <th className="text-right px-3 py-2 font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {report.bonusBreakdown.map((tier, index) => (
                    <tr key={index} className="border-b last:border-b-0">
                      <td className="px-3 py-2">{tier.tierName}</td>
                      <td className="text-right px-3 py-2">{tier.meetingsInRange}</td>
                      <td className="text-right px-3 py-2">{formatDollars(tier.rate)}</td>
                      <td className="text-right px-3 py-2">{formatDollars(tier.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Calculated Bonus Total */}
        <div className="flex items-center justify-between pt-1">
          <p className="text-sm font-medium">Calculated Bonus</p>
          <p className="text-lg font-bold">{formatDollars(report.calculatedBonus)}</p>
        </div>

        {/* BDR Notes */}
        {report.notes && (
          <div>
            <p className="text-sm font-medium mb-1">BDR Notes</p>
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
              {report.notes}
            </p>
          </div>
        )}

        {/* Admin Notes - textarea for SUBMITTED, read-only display for others */}
        {isSubmitted ? (
          <div className="space-y-2">
            <Label htmlFor={`admin-notes-${report.id}`}>Admin Notes</Label>
            <Textarea
              id={`admin-notes-${report.id}`}
              value={adminNotes}
              onChange={(e) => {
                setAdminNotes(e.target.value);
                if (notesError) setNotesError('');
              }}
              placeholder="Optional notes (required when flagging for correction)"
              rows={3}
            />
            {notesError && (
              <p className="text-sm text-destructive">{notesError}</p>
            )}
          </div>
        ) : (
          report.adminNotes && (
            <div>
              <p className="text-sm font-medium mb-1">Admin Notes</p>
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
                {report.adminNotes}
              </p>
            </div>
          )
        )}

        {/* Action Buttons - only for SUBMITTED reports */}
        {isSubmitted && (
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleApprove}
              disabled={isLoading}
              className="flex-1"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {isApproving ? 'Approving...' : 'Approve'}
            </Button>
            <Button
              variant="destructive"
              onClick={handleFlag}
              disabled={isLoading}
              className="flex-1"
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              {isFlagging ? 'Flagging...' : 'Flag for Correction'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
