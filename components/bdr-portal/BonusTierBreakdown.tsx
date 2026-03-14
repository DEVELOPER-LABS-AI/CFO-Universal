'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface BreakdownLine {
  tierName: string;
  meetingsInRange: number;
  rate: number;
  subtotal: number;
}

interface BonusTierBreakdownProps {
  breakdown: BreakdownLine[];
  totalBonus: number;
}

/**
 * Displays the per-tier bonus calculation breakdown.
 */
export function BonusTierBreakdown({ breakdown, totalBonus }: BonusTierBreakdownProps) {
  if (breakdown.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Bonus Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No bonus tiers applied. Your bonus is $0.00.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Bonus Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tier</TableHead>
              <TableHead className="text-right">Meetings</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {breakdown.map((line, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{line.tierName}</TableCell>
                <TableCell className="text-right">{line.meetingsInRange}</TableCell>
                <TableCell className="text-right">${line.rate.toFixed(2)}</TableCell>
                <TableCell className="text-right">${line.subtotal.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="font-semibold">
                Total Bonus
              </TableCell>
              <TableCell className="text-right font-semibold text-emerald-600">
                ${totalBonus.toFixed(2)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
