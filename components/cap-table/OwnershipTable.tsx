'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/** A single share class holding for a stakeholder. */
interface Holding {
  share_class_id: string;
  share_class_name: string;
  shares_held: number;
  ownership_percentage: number;
}

/** A stakeholder with their aggregated holdings. */
export interface Stakeholder {
  id: string;
  name: string;
  email: string | null;
  role_title: string | null;
  holdings: Holding[];
  total_shares: number;
  total_ownership_percentage: number;
}

/** Summary totals for the cap table. */
export interface CapTableTotals {
  total_authorized: number;
  total_issued: number;
  total_reserved: number;
  total_available: number;
}

export interface OwnershipTableProps {
  /** Array of stakeholders and their holdings. */
  stakeholders: Stakeholder[];
  /** Summary totals for authorized, issued, reserved, and available shares. */
  totals: CapTableTotals;
  /** Callback when the edit action is triggered for a stakeholder. */
  onEditStakeholder?: (stakeholder: Stakeholder) => void;
  /** Callback when the remove action is triggered for a stakeholder. */
  onRemoveStakeholder?: (id: string) => void;
  /** When true, hides edit and remove action buttons. Defaults to false. */
  readOnly?: boolean;
}

/**
 * Formats a number to 4 decimal places with a percent sign.
 * Example: 33.3333%
 */
function formatOwnership(percentage: number): string {
  return `${percentage.toFixed(4)}%`;
}

/**
 * Formats a number with locale-aware thousand separators.
 */
function formatShares(shares: number): string {
  return shares.toLocaleString();
}

/**
 * Displays a cap table of stakeholders, their share class holdings,
 * ownership percentages, and summary totals. Supports optional edit
 * and remove actions per stakeholder row.
 */
export function OwnershipTable({
  stakeholders,
  totals,
  onEditStakeholder,
  onRemoveStakeholder,
  readOnly = false,
}: OwnershipTableProps) {
  const showActions = !readOnly && (!!onEditStakeholder || !!onRemoveStakeholder);

  const sumOwnership = stakeholders.reduce(
    (sum, s) => sum + s.total_ownership_percentage,
    0
  );
  const sumShares = stakeholders.reduce(
    (sum, s) => sum + s.total_shares,
    0
  );

  if (stakeholders.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        No stakeholders yet. Add stakeholders to populate the cap table.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Stakeholder Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Share Class</TableHead>
            <TableHead className="text-right">Shares Held</TableHead>
            <TableHead className="text-right">Ownership %</TableHead>
            {showActions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>

        <TableBody>
          {stakeholders.map((stakeholder) => {
            const holdingCount = stakeholder.holdings.length;

            // Single holding -- render one row
            if (holdingCount <= 1) {
              const holding = stakeholder.holdings[0];
              return (
                <TableRow key={stakeholder.id}>
                  <TableCell className="font-medium">{stakeholder.name}</TableCell>
                  <TableCell>{stakeholder.role_title}</TableCell>
                  <TableCell>{holding?.share_class_name ?? '-'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatShares(stakeholder.total_shares)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatOwnership(stakeholder.total_ownership_percentage)}
                  </TableCell>
                  {showActions && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {onEditStakeholder && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEditStakeholder(stakeholder)}
                            aria-label={`Edit ${stakeholder.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {onRemoveStakeholder && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onRemoveStakeholder(stakeholder.id)}
                            aria-label={`Remove ${stakeholder.name}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            }

            // Multiple holdings -- render a primary row + sub-rows
            return stakeholder.holdings.map((holding, index) => {
              const isFirst = index === 0;
              return (
                <TableRow
                  key={`${stakeholder.id}-${holding.share_class_id}`}
                  className={!isFirst ? 'border-t-0' : undefined}
                >
                  {/* Name and role only on the first sub-row */}
                  <TableCell className={isFirst ? 'font-medium' : 'pl-8 text-muted-foreground'}>
                    {isFirst ? stakeholder.name : ''}
                  </TableCell>
                  <TableCell>{isFirst ? stakeholder.role_title : ''}</TableCell>
                  <TableCell>{holding.share_class_name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatShares(holding.shares_held)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatOwnership(holding.ownership_percentage)}
                  </TableCell>
                  {showActions && (
                    <TableCell className="text-right">
                      {isFirst && (
                        <div className="flex items-center justify-end gap-1">
                          {onEditStakeholder && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onEditStakeholder(stakeholder)}
                              aria-label={`Edit ${stakeholder.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {onRemoveStakeholder && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onRemoveStakeholder(stakeholder.id)}
                              aria-label={`Remove ${stakeholder.name}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            });
          })}
        </TableBody>

        <TableFooter>
          <TableRow>
            <TableCell colSpan={3} className="font-semibold">
              Total
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {formatShares(sumShares)}
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {formatOwnership(sumOwnership)}
            </TableCell>
            {showActions && <TableCell />}
          </TableRow>
        </TableFooter>
      </Table>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground px-1">
        <span>
          Authorized: <span className="font-medium text-foreground">{formatShares(totals.total_authorized)}</span> shares
        </span>
        <span>
          Issued: <span className="font-medium text-foreground">{formatShares(totals.total_issued)}</span> shares
        </span>
        <span>
          Reserved: <span className="font-medium text-foreground">{formatShares(totals.total_reserved)}</span> shares
        </span>
        <span>
          Available: <span className="font-medium text-foreground">{formatShares(totals.total_available)}</span> shares
        </span>
      </div>
    </div>
  );
}
