'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, ArrowRightLeft, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShareClassConfig } from '@/components/cap-table/ShareClassConfig';
import { OwnershipTable, type Stakeholder } from '@/components/cap-table/OwnershipTable';
import { OwnershipChart } from '@/components/cap-table/OwnershipChart';
import { AddStakeholderModal } from '@/components/cap-table/AddStakeholderModal';
import { RecordTransactionModal } from '@/components/cap-table/RecordTransactionModal';
import { TransactionLedger } from '@/components/cap-table/TransactionLedger';
import { ShareLinkDialog } from '@/components/cap-table/ShareLinkDialog';
import { PointInTimeSelector } from '@/components/cap-table/PointInTimeSelector';
import { removeStakeholder } from '@/app/actions/cap-table';

/** Shape of the cap table summary returned from getCapTableSummary. */
interface CapTableSummary {
  share_classes: Array<{
    id: string;
    name: string;
    authorized_shares: number;
    reserved_shares: number;
    issued_shares: number;
    available_shares: number;
    price_per_share: number | null;
  }>;
  stakeholders: Array<{
    id: string;
    name: string;
    email: string | null;
    role_title: string | null;
    holdings: Array<{
      share_class_id: string;
      share_class_name: string;
      shares_held: number;
      ownership_percentage: number;
    }>;
    total_shares: number;
    total_ownership_percentage: number;
  }>;
  totals: {
    total_authorized: number;
    total_issued: number;
    total_reserved: number;
    total_available: number;
  };
}

/** Shape of a single transaction from getTransactionHistory. */
interface Transaction {
  id: string;
  transaction_type: string;
  transaction_date: string;
  share_class: { id: string; name: string };
  from_stakeholder: { id: string; name: string } | null;
  to_stakeholder: { id: string; name: string } | null;
  shares_affected: number;
  price_per_share: number | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

interface CapTableDashboardProps {
  summary: CapTableSummary;
  transactions: Transaction[];
  /** Whether CAP_TABLE_SHARE_SECRET is configured (server-side check). */
  shareConfigured: boolean;
}

/**
 * Client-side dashboard that wires together all cap table components.
 * Manages modal state, stakeholder editing, point-in-time historical view,
 * and share link generation.
 */
export function CapTableDashboard({ summary, transactions, shareConfigured }: CapTableDashboardProps) {
  // Modal state
  const [stakeholderModalOpen, setStakeholderModalOpen] = useState(false);
  const [editingStakeholder, setEditingStakeholder] = useState<Stakeholder | undefined>();
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [shareLinkOpen, setShareLinkOpen] = useState(false);

  // Point-in-time state
  const [historicalData, setHistoricalData] = useState<CapTableSummary | null>(null);
  const isHistorical = historicalData !== null;
  const displayData = historicalData ?? summary;

  /**
   * Opens the stakeholder modal in edit mode with the selected stakeholder.
   */
  function handleEditStakeholder(stakeholder: Stakeholder) {
    setEditingStakeholder(stakeholder);
    setStakeholderModalOpen(true);
  }

  /**
   * Soft-deletes a stakeholder after confirmation.
   */
  async function handleRemoveStakeholder(id: string) {
    if (!confirm('Are you sure you want to remove this stakeholder?')) return;
    try {
      await removeStakeholder({ id });
      toast.success('Stakeholder removed');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to remove stakeholder';
      toast.error(message);
    }
  }

  /**
   * Closes the stakeholder modal and resets edit state.
   */
  function handleStakeholderModalClose(open: boolean) {
    if (!open) setEditingStakeholder(undefined);
    setStakeholderModalOpen(open);
  }

  return (
    <>
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={isHistorical} onClick={() => { setEditingStakeholder(undefined); setStakeholderModalOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" />
          Add Stakeholder
        </Button>
        <Button size="sm" variant="outline" disabled={isHistorical} onClick={() => setTransactionModalOpen(true)}>
          <ArrowRightLeft className="mr-1 h-4 w-4" />
          Record Transaction
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!shareConfigured}
          onClick={() => setShareLinkOpen(true)}
          title={!shareConfigured ? 'Set CAP_TABLE_SHARE_SECRET to enable sharing' : undefined}
        >
          <Share2 className="mr-1 h-4 w-4" />
          Share
        </Button>
        <div className="ml-auto">
          <PointInTimeSelector
            onDateSelect={(data) => setHistoricalData(data)}
            onReset={() => setHistoricalData(null)}
            isHistorical={isHistorical}
          />
        </div>
      </div>

      {/* Historical view banner */}
      {isHistorical && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
          Viewing historical snapshot. Data is read-only.
        </div>
      )}

      {/* Share class cards */}
      <ShareClassConfig shareClasses={displayData.share_classes} />

      {/* Ownership section: table + chart */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ownership Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <OwnershipTable
              stakeholders={displayData.stakeholders as Stakeholder[]}
              totals={displayData.totals}
              onEditStakeholder={isHistorical ? undefined : handleEditStakeholder}
              onRemoveStakeholder={isHistorical ? undefined : handleRemoveStakeholder}
              readOnly={isHistorical}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ownership Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <OwnershipChart
              stakeholders={displayData.stakeholders}
              totalIssued={displayData.totals.total_issued}
            />
          </CardContent>
        </Card>
      </div>

      {/* Transaction history */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionLedger transactions={transactions} />
        </CardContent>
      </Card>

      {/* Modals */}
      <AddStakeholderModal
        open={stakeholderModalOpen}
        onOpenChange={handleStakeholderModalClose}
        stakeholder={editingStakeholder as any}
      />

      <RecordTransactionModal
        open={transactionModalOpen}
        onOpenChange={setTransactionModalOpen}
        shareClasses={displayData.share_classes.map((sc) => ({ id: sc.id, name: sc.name }))}
        stakeholders={displayData.stakeholders.map((s) => ({ id: s.id, name: s.name }))}
      />

      <ShareLinkDialog
        open={shareLinkOpen}
        onOpenChange={setShareLinkOpen}
      />
    </>
  );
}
