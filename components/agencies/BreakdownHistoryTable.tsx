'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDate } from '@/lib/utils/date';

// T121: BreakdownHistoryTable component showing monthly snapshots

interface AgencyMonthlyBreakdown {
  id: string;
  agency_id: string;
  month: number;
  year: number;
  breakdown: any; // JSONB
  breakdown_total: any;
  variance: any;
  created_at: Date;
  updated_at: Date;
}

interface BreakdownHistoryTableProps {
  breakdowns: AgencyMonthlyBreakdown[];
  monthlyPayment: number;
}

interface StaffMember {
  name: string;
  role: string;
  cost: number;
}

export function BreakdownHistoryTable({ breakdowns, monthlyPayment }: BreakdownHistoryTableProps) {
  const [selectedBreakdown, setSelectedBreakdown] = useState<AgencyMonthlyBreakdown | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getStaffFromBreakdown = (breakdown: any): StaffMember[] => {
    if (!breakdown || typeof breakdown !== 'object') return [];
    if (Array.isArray(breakdown.staff)) {
      return breakdown.staff;
    }
    return [];
  };

  const getMonthName = (month: number) => {
    return new Date(2000, month - 1).toLocaleString('default', { month: 'long' });
  };

  if (breakdowns.length === 0) {
    return (
      <EmptyState
        icon={<Calendar className="h-12 w-12" />}
        title="No breakdown history"
        description="Create monthly breakdowns to track agency staffing changes over time"
      />
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Desktop Table */}
        <div className="hidden md:block border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Staff Count</TableHead>
                <TableHead className="text-right">Breakdown Total</TableHead>
                <TableHead className="text-right">Expected Payment</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdowns.map((breakdown) => {
                const staff = getStaffFromBreakdown(breakdown.breakdown);
                const total = Number(breakdown.breakdown_total);
                const variance = Number(breakdown.variance);
                const hasVariance = Math.abs(variance) > 100;
                const isExpanded = expandedRows.has(breakdown.id);

                return (
                  <>
                    <TableRow key={breakdown.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRow(breakdown.id)}
                          className="h-8 w-8 p-0"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">
                        {getMonthName(breakdown.month)} {breakdown.year}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{staff.length} staff</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${total.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ${monthlyPayment.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {hasVariance ? (
                          <div className="flex items-center justify-end gap-1">
                            <AlertTriangle className="h-3 w-3 text-orange-600" />
                            <span className="text-orange-600 font-medium">
                              {variance >= 0 ? '+' : ''}${variance.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-green-600 font-medium">
                            {variance >= 0 ? '+' : ''}${variance.toFixed(2)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(breakdown.updated_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedBreakdown(breakdown)}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>

                    {/* Expanded Row - Staff Details */}
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/50">
                          <div className="py-4 px-6">
                            <h4 className="font-medium mb-3">Staff Breakdown</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {staff.map((member, index) => (
                                <div key={index} className="border rounded-lg p-3 bg-background">
                                  <p className="font-medium">{member.name}</p>
                                  <div className="flex items-center justify-between mt-1">
                                    <Badge variant="outline" className="text-xs">
                                      {member.role}
                                    </Badge>
                                    <span className="text-sm font-semibold">
                                      ${Number(member.cost).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-4">
          {breakdowns.map((breakdown) => {
            const staff = getStaffFromBreakdown(breakdown.breakdown);
            const total = Number(breakdown.breakdown_total);
            const variance = Number(breakdown.variance);
            const hasVariance = Math.abs(variance) > 100;

            return (
              <div key={breakdown.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">
                      {getMonthName(breakdown.month)} {breakdown.year}
                    </p>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {staff.length} staff
                    </Badge>
                  </div>
                  {hasVariance && <AlertTriangle className="h-4 w-4 text-orange-600" />}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Breakdown Total</p>
                    <p className="font-semibold">${total.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Variance</p>
                    <p className={`font-semibold ${hasVariance ? 'text-orange-600' : 'text-green-600'}`}>
                      {variance >= 0 ? '+' : ''}${variance.toFixed(2)}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setSelectedBreakdown(breakdown)}
                >
                  View Details
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Details Dialog */}
      <Dialog open={!!selectedBreakdown} onOpenChange={() => setSelectedBreakdown(null)}>
        <DialogContent className="sm:max-w-[600px]">
          {selectedBreakdown && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {getMonthName(selectedBreakdown.month)} {selectedBreakdown.year} Breakdown
                </DialogTitle>
                <DialogDescription>
                  Detailed staff breakdown for this period
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Staff</p>
                    <p className="text-lg font-bold">
                      {getStaffFromBreakdown(selectedBreakdown.breakdown).length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Cost</p>
                    <p className="text-lg font-bold">
                      ${Number(selectedBreakdown.breakdown_total).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Variance</p>
                    <p
                      className={`text-lg font-bold ${Math.abs(Number(selectedBreakdown.variance)) > 100 ? 'text-orange-600' : 'text-green-600'}`}
                    >
                      {Number(selectedBreakdown.variance) >= 0 ? '+' : ''}$
                      {Number(selectedBreakdown.variance).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Staff List */}
                <div className="space-y-2">
                  <h4 className="font-medium">Staff Members</h4>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {getStaffFromBreakdown(selectedBreakdown.breakdown).map((member, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <Badge variant="outline" className="text-xs mt-1">
                            {member.role}
                          </Badge>
                        </div>
                        <p className="text-lg font-semibold">${Number(member.cost).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
