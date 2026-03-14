/**
 * Merchant Mapping Content (Client Component)
 *
 * Tabs: "Unmapped" | "Deposits" (T047) | "All Mappings"
 * Receives organizationId from server component wrapper.
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AddSubscriptionModal } from '@/components/subscriptions/AddSubscriptionModal';
import { AddContractorModal } from '@/components/contractors/AddContractorModal';
import { AddQuickClientModal } from '@/components/clients/AddQuickClientModal';
import { AddAgencyModal } from '@/components/agencies/AddAgencyModal';
import { AddExpenseCategoryModal } from '@/components/expenses/AddExpenseCategoryModal';
import { PerTransactionRulesPanel } from '@/components/mercury/PerTransactionRulesPanel';
import { LinkDepositModal } from '@/components/mercury/LinkDepositModal';
import { refreshClientROI } from '@/app/actions/roi-calculations';
import { getErrorMessage } from '@/lib/utils/error';

type MappingType = 'contractor' | 'subscription' | 'client' | 'agency' | 'expense' | 'owner' | 'per_transaction';

type SortDirection = 'asc' | 'desc';
interface SortConfig {
  column: string;
  direction: SortDirection;
}

/** Clickable column header with sort indicator */
function SortableHeader({
  label,
  column,
  sortConfig,
  onSort,
}: {
  label: string;
  column: string;
  sortConfig: SortConfig;
  onSort: (column: string) => void;
}) {
  const isActive = sortConfig.column === column;
  return (
    <th
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`text-[10px] ${isActive ? 'text-blue-600' : 'text-gray-300'}`}>
          {isActive ? (sortConfig.direction === 'asc' ? '\u25B2' : '\u25BC') : '\u25B4\u25BE'}
        </span>
      </span>
    </th>
  );
}

interface UnmappedMerchant {
  id: string;
  mercury_merchant_name: string;
  normalized_merchant_name: string;
  mapped_at: Date;
  last_transaction_date?: string | null;
  transaction_type?: 'DEBIT' | 'CREDIT' | 'UNKNOWN';
  suggested_subscription_id?: string | null;
  suggested_subscription_name?: string | null;
}

interface UnassociatedDeposit {
  id: string;
  mercury_transaction_id: string;
  counterparty_name: string;
  amount: number;
  transaction_date: string;
  suggested_client_id: string | null;
  suggested_client_name: string | null;
  suggestion_confidence: number | null;
}

interface MappingEntry {
  id: string;
  mercury_merchant_name: string;
  normalized_merchant_name: string;
  mapping_confidence: string;
  confidence_score: number | null;
  mapped_by: string;
  mapped_at: string;
  last_transaction_date: string | null;
  contractor_id: string | null;
  agency_id: string | null;
  subscription_id: string | null;
  client_id: string | null;
  expense_category_id: string | null;
  staff_id: string | null;
  mapping_mode?: 'SINGLE' | 'PER_TRANSACTION';
  contractor_name: string | null;
  agency_name: string | null;
  subscription_name: string | null;
  client_name: string | null;
  expense_category_name: string | null;
  staff_name: string | null;
}

interface MerchantTransaction {
  id: string;
  amount: number;
  transaction_date: string;
  description: string | null;
  is_credit: boolean;
  category: string | null;
}

interface Contractor {
  id: string;
  name: string;
  engagement_type?: string;
}

interface Agency {
  id: string;
  name: string;
}

interface Subscription {
  id: string;
  name: string;
}

type Tab = 'unmapped' | 'deposits' | 'all';

interface MerchantMappingContentProps {
  organizationId: string;
}

export function MerchantMappingContent({ organizationId }: MerchantMappingContentProps) {
  const [activeTab, setActiveTab] = useState<Tab>('unmapped');

  // Unmapped tab state
  const [merchants, setMerchants] = useState<UnmappedMerchant[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<{ id: string; name: string }[]>([]);
  const [ownerStaff, setOwnerStaff] = useState<{ id: string; name: string }[]>([]);

  // Unified mapping state: type selector + entity target per merchant row
  const [mappingTypes, setMappingTypes] = useState<Record<string, MappingType>>({});
  const [mappingTargets, setMappingTargets] = useState<Record<string, string>>({});
  const [expenseClientIds, setExpenseClientIds] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // All mappings tab state
  const [allMappings, setAllMappings] = useState<MappingEntry[]>([]);
  const [allAgencies, setAllAgencies] = useState<Agency[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);
  const [unmapping, setUnmapping] = useState<string | null>(null);

  // Deposits tab state (T047)
  const [deposits, setDeposits] = useState<UnassociatedDeposit[]>([]);
  const [depositsLoading, setDepositsLoading] = useState(false);
  const [depositsLoaded, setDepositsLoaded] = useState(false);
  const [linkingDeposit, setLinkingDeposit] = useState<string | null>(null);
  const [selectedClients, setSelectedClients] = useState<Record<string, string>>({});

  // Link deposit modal state
  const [linkModalDeposit, setLinkModalDeposit] = useState<UnassociatedDeposit | null>(null);
  const [feeDefaults, setFeeDefaults] = useState<Record<string, number>>({
    ACH: 0.005, CREDIT_CARD: 0.03, DOMESTIC_WIRE: 0, INTERNATIONAL_WIRE: 0, CHECK: 0,
  });

  // Subscription fuzzy promotion state (T051)
  const [promoting, setPromoting] = useState<string | null>(null);

  // Expandable transaction row state
  const [expandedMerchant, setExpandedMerchant] = useState<string | null>(null);
  const [merchantTransactions, setMerchantTransactions] = useState<Record<string, MerchantTransaction[]>>({});
  const [loadingTransactions, setLoadingTransactions] = useState<string | null>(null);

  // Sort state for each tab
  const [unmappedSort, setUnmappedSort] = useState<SortConfig>({ column: 'transaction_date', direction: 'desc' });
  const [depositsSort, setDepositsSort] = useState<SortConfig>({ column: 'transaction_date', direction: 'desc' });
  const [allSort, setAllSort] = useState<SortConfig>({ column: 'last_seen', direction: 'desc' });

  /** Toggle sort on a column: clicking the same column flips direction, clicking a new column sorts desc first */
  const toggleSort = (setter: React.Dispatch<React.SetStateAction<SortConfig>>) => (column: string) => {
    setter((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: 'desc' }
    );
  };

  /** Generic comparator for sorting */
  function compareValues(a: any, b: any, direction: SortDirection): number {
    if (a == null && b == null) return 0;
    if (a == null) return direction === 'asc' ? -1 : 1;
    if (b == null) return direction === 'asc' ? 1 : -1;
    if (typeof a === 'string' && typeof b === 'string') {
      return direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
    }
    if (typeof a === 'number' && typeof b === 'number') {
      return direction === 'asc' ? a - b : b - a;
    }
    // Date strings
    const da = new Date(a).getTime();
    const db = new Date(b).getTime();
    if (!isNaN(da) && !isNaN(db)) {
      return direction === 'asc' ? da - db : db - da;
    }
    return 0;
  }

  /** Sorted unmapped merchants */
  const sortedMerchants = useMemo(() => {
    const sorted = [...merchants];
    sorted.sort((a, b) => {
      const col = unmappedSort.column;
      let va: any, vb: any;
      if (col === 'merchant_name') { va = a.mercury_merchant_name; vb = b.mercury_merchant_name; }
      else if (col === 'transaction_type') { va = a.transaction_type ?? ''; vb = b.transaction_type ?? ''; }
      else if (col === 'transaction_date') { va = a.last_transaction_date ?? a.mapped_at; vb = b.last_transaction_date ?? b.mapped_at; }
      else if (col === 'suggestion') { va = a.suggested_subscription_name ?? ''; vb = b.suggested_subscription_name ?? ''; }
      else { va = (a as any)[col]; vb = (b as any)[col]; }
      return compareValues(va, vb, unmappedSort.direction);
    });
    return sorted;
  }, [merchants, unmappedSort]);

  /** Sorted deposits */
  const sortedDeposits = useMemo(() => {
    const sorted = [...deposits];
    sorted.sort((a, b) => {
      const col = depositsSort.column;
      let va: any, vb: any;
      if (col === 'counterparty_name') { va = a.counterparty_name; vb = b.counterparty_name; }
      else if (col === 'transaction_date') { va = a.transaction_date; vb = b.transaction_date; }
      else if (col === 'amount') { va = Number(a.amount); vb = Number(b.amount); }
      else if (col === 'suggested_client') { va = a.suggested_client_name ?? ''; vb = b.suggested_client_name ?? ''; }
      else { va = (a as any)[col]; vb = (b as any)[col]; }
      return compareValues(va, vb, depositsSort.direction);
    });
    return sorted;
  }, [deposits, depositsSort]);

  /** Sorted all mappings */
  const sortedAllMappings = useMemo(() => {
    const sorted = [...allMappings];
    sorted.sort((a, b) => {
      const col = allSort.column;
      let va: any, vb: any;
      if (col === 'merchant') { va = a.mercury_merchant_name; vb = b.mercury_merchant_name; }
      else if (col === 'mapped_to') { va = a.contractor_name ?? a.agency_name ?? a.subscription_name ?? a.client_name ?? a.expense_category_name ?? a.staff_name ?? ''; vb = b.contractor_name ?? b.agency_name ?? b.subscription_name ?? b.client_name ?? b.expense_category_name ?? b.staff_name ?? ''; }
      else if (col === 'type') {
        va = a.contractor_name ? 'Contractor' : a.agency_name ? 'Agency' : a.subscription_name ? 'Subscription' : a.client_name ? 'Client' : a.expense_category_name ? 'Expense' : a.staff_name ? 'Owner' : '';
        vb = b.contractor_name ? 'Contractor' : b.agency_name ? 'Agency' : b.subscription_name ? 'Subscription' : b.client_name ? 'Client' : b.expense_category_name ? 'Expense' : b.staff_name ? 'Owner' : '';
      }
      else if (col === 'confidence') { va = a.mapping_confidence; vb = b.mapping_confidence; }
      else if (col === 'last_seen') { va = a.last_transaction_date ?? a.mapped_at; vb = b.last_transaction_date ?? b.mapped_at; }
      else { va = (a as any)[col]; vb = (b as any)[col]; }
      return compareValues(va, vb, allSort.direction);
    });
    return sorted;
  }, [allMappings, allSort]);

  useEffect(() => {
    if (organizationId) loadMerchants();
  }, [organizationId]);

  useEffect(() => {
    if (activeTab === 'all' && organizationId && !allLoaded) loadAllMappings();
  }, [activeTab, organizationId]);

  useEffect(() => {
    if (activeTab === 'deposits' && organizationId && !depositsLoaded) loadDeposits();
  }, [activeTab, organizationId]);

  const loadMerchants = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/mercury/merchants/unmapped?organizationId=${organizationId}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load merchants');
      }
      const data = await response.json();
      setMerchants(data.unmapped_merchants);
      setContractors(data.contractors);
      setClients(data.clients ?? []);
      setSubscriptions(data.subscriptions ?? []);
      setAgencies(data.agencies ?? []);
      setExpenseCategories(data.expenseCategories ?? []);
      setOwnerStaff(data.ownerStaff ?? []);
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Failed to load merchants');
    } finally {
      setLoading(false);
    }
  };

  const loadAllMappings = async () => {
    try {
      setAllLoading(true);
      const response = await fetch(`/api/mercury/merchants/all?organizationId=${organizationId}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load mappings');
      }
      const data = await response.json();
      setAllMappings(data.mappings);
      setAllAgencies(data.agencies);
      if (contractors.length === 0) setContractors(data.contractors);
      setAllLoaded(true);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to load mappings');
    } finally {
      setAllLoading(false);
    }
  };

  /** Set the mapping type for a merchant row; clears the entity target and expense client */
  const handleSetMappingType = (merchantId: string, type: MappingType | '') => {
    if (!type) {
      setMappingTypes((prev) => { const u = { ...prev }; delete u[merchantId]; return u; });
      setMappingTargets((prev) => { const u = { ...prev }; delete u[merchantId]; return u; });
    } else {
      setMappingTypes((prev) => ({ ...prev, [merchantId]: type }));
      setMappingTargets((prev) => { const u = { ...prev }; delete u[merchantId]; return u; });
    }
    setExpenseClientIds((prev) => { const u = { ...prev }; delete u[merchantId]; return u; });
  };

  /** Set the entity target for a merchant row */
  const handleSetMappingTarget = (merchantId: string, entityId: string) => {
    if (!entityId) {
      setMappingTargets((prev) => { const u = { ...prev }; delete u[merchantId]; return u; });
    } else {
      setMappingTargets((prev) => ({ ...prev, [merchantId]: entityId }));
    }
  };

  /** Callback when a new entity is created inline */
  const handleEntityCreated = (merchantId: string, type: MappingType, entity: { id: string; name: string }) => {
    if (type === 'contractor') {
      setContractors((prev) => [...prev, { id: entity.id, name: entity.name }].sort((a, b) => a.name.localeCompare(b.name)));
    } else if (type === 'subscription') {
      setSubscriptions((prev) => [...prev, { id: entity.id, name: entity.name }].sort((a, b) => a.name.localeCompare(b.name)));
    } else if (type === 'client') {
      setClients((prev) => [...prev, { id: entity.id, name: entity.name }].sort((a, b) => a.name.localeCompare(b.name)));
    } else if (type === 'agency') {
      setAgencies((prev) => [...prev, { id: entity.id, name: entity.name }].sort((a, b) => a.name.localeCompare(b.name)));
    } else if (type === 'expense') {
      setExpenseCategories((prev) => [...prev, { id: entity.id, name: entity.name }].sort((a, b) => a.name.localeCompare(b.name)));
    }
    setMappingTargets((prev) => ({ ...prev, [merchantId]: entity.id }));
  };

  /** Save the mapping (unified handler for all types) */
  const handleSaveMapping = async (merchantId: string) => {
    const type = mappingTypes[merchantId];

    // Per-transaction mode doesn't need an entity target
    if (type === 'per_transaction') {
      try {
        setSavingId(merchantId);
        const response = await fetch('/api/mercury/merchants/map', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ merchantMappingId: merchantId, perTransaction: true, organizationId }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to set per-transaction mode');
        }
        toast.success('Merchant set to per-transaction mode. Configure rules in All Mappings.');
        setMerchants((prev) => prev.filter((m) => m.id !== merchantId));
        setMappingTypes((prev) => { const u = { ...prev }; delete u[merchantId]; return u; });
        setAllLoaded(false);
      } catch (err: unknown) {
        toast.error(getErrorMessage(err) || 'Failed to set per-transaction mode');
      } finally {
        setSavingId(null);
      }
      return;
    }

    const targetId = mappingTargets[merchantId];
    if (!type || !targetId) {
      toast.error('Please select a mapping type and entity');
      return;
    }

    const bodyKey = type === 'contractor' ? 'contractorId' : type === 'subscription' ? 'subscriptionId' : type === 'agency' ? 'agencyId' : type === 'expense' ? 'expenseCategoryId' : type === 'owner' ? 'staffId' : 'clientId';

    // Optional client allocation for expense mappings
    const expenseClientId = type === 'expense' ? expenseClientIds[merchantId] : undefined;

    try {
      setSavingId(merchantId);
      const response = await fetch('/api/mercury/merchants/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantMappingId: merchantId, [bodyKey]: targetId, ...(expenseClientId && { expenseClientId }), organizationId }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save mapping');
      }
      const data = await response.json();
      const countMsg = data.backfill_count ? ` ${data.backfill_count} transactions backfilled.` : '';
      toast.success(`Merchant mapped to ${type}.${countMsg}`);
      setMerchants((prev) => prev.filter((m) => m.id !== merchantId));
      setMappingTypes((prev) => { const u = { ...prev }; delete u[merchantId]; return u; });
      setMappingTargets((prev) => { const u = { ...prev }; delete u[merchantId]; return u; });
      setExpenseClientIds((prev) => { const u = { ...prev }; delete u[merchantId]; return u; });
      setAllLoaded(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to save mapping');
    } finally {
      setSavingId(null);
    }
  };

  const handleUnmap = (mappingId: string, merchantName: string) => {
    // Optimistic update: immediately reflect in UI before the API call
    setUnmapping(mappingId);
    setAllMappings((prev) => prev.map((m) =>
      m.id === mappingId
        ? { ...m, contractor_id: null, contractor_name: null, agency_id: null, agency_name: null, subscription_id: null, subscription_name: null, client_id: null, client_name: null, expense_category_id: null, expense_category_name: null, staff_id: null, staff_name: null, mapping_confidence: 'MANUAL' as any, confidence_score: null }
        : m
    ));

    // Defer the network call so the click event completes without blocking UI
    requestAnimationFrame(() => {
      (async () => {
        try {
          const response = await fetch(`/api/mercury/merchants/unmap?id=${mappingId}&organizationId=${organizationId}`, { method: 'DELETE' });
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to unmap merchant');
          }
          toast.success(`"${merchantName}" unmapped`);
        } catch (err: unknown) {
          toast.error(getErrorMessage(err) || 'Failed to unmap merchant');
          // Revert optimistic update on failure by reloading
          loadAllMappings();
        } finally {
          setUnmapping(null);
        }
      })();
    });
  };

  const loadDeposits = async () => {
    if (!organizationId) return;
    try {
      setDepositsLoading(true);
      const connection = await fetch(`/api/mercury/connection/status?organizationId=${organizationId}`);
      const connData = await connection.json();
      const connectionId = connData?.connection?.id;
      if (!connectionId) return;
      const res = await fetch(`/api/mercury/deposits/unassociated?organizationId=${organizationId}&connectionId=${connectionId}`);
      const data = await res.json();
      setDeposits(data.data ?? []);
      setDepositsLoaded(true);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to load deposits');
    } finally {
      setDepositsLoading(false);
    }
  };

  const handleLinkDeposit = async (depositId: string, mercuryTransactionId: string) => {
    const clientId = selectedClients[depositId];
    if (!clientId) { toast.error('Select a client first'); return; }
    try {
      setLinkingDeposit(depositId);
      const res = await fetch('/api/mercury/deposits/link-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mercuryTransactionId, clientId, organizationId, userId: 'admin' }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message ?? data.error ?? 'Failed to link deposit'); return; }
      toast.success('Deposit linked to client');
      setDeposits((prev) => prev.filter((d) => d.id !== depositId));
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to link deposit');
    } finally {
      setLinkingDeposit(null);
    }
  };

  const handlePromoteToExact = async (merchant: UnmappedMerchant) => {
    if (!merchant.suggested_subscription_id) return;
    try {
      setPromoting(merchant.id);
      const connectionRes = await fetch(`/api/mercury/connection/status?organizationId=${organizationId}`);
      const connData = await connectionRes.json();
      const connectionId = connData?.connection?.id;
      if (!connectionId) { toast.error('Mercury connection not found'); return; }
      const res = await fetch('/api/mercury/merchants/promote-fuzzy-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          normalizedMerchantName: merchant.normalized_merchant_name,
          subscriptionId: merchant.suggested_subscription_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message ?? data.error ?? 'Failed to promote mapping'); return; }
      toast.success(`"${merchant.mercury_merchant_name}" confirmed as subscription mapping`);
      setMerchants((prev) => prev.filter((m) => m.id !== merchant.id));
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to promote mapping');
    } finally {
      setPromoting(null);
    }
  };

  const confidenceLabel = (confidence: string) => {
    switch (confidence) {
      case 'EXACT': return 'Exact';
      case 'FUZZY': return 'Fuzzy';
      case 'MANUAL': return 'Manual';
      default: return confidence;
    }
  };

  /** Toggle expanded transactions for a merchant row. Fetches on first expand, then caches. */
  const toggleMerchantExpand = async (merchantName: string) => {
    if (expandedMerchant === merchantName) {
      setExpandedMerchant(null);
      return;
    }
    setExpandedMerchant(merchantName);
    if (merchantTransactions[merchantName]) return;
    try {
      setLoadingTransactions(merchantName);
      const res = await fetch(
        `/api/mercury/merchants/transactions?organizationId=${organizationId}&merchantName=${encodeURIComponent(merchantName)}`
      );
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();
      setMerchantTransactions((prev) => ({ ...prev, [merchantName]: data.transactions }));
    } catch {
      toast.error('Failed to load transactions');
    } finally {
      setLoadingTransactions(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vendor Mapping</h1>
        <p className="text-gray-600 mt-1">
          Permanently map Mercury vendors to contractors, subscriptions, or agencies. Future transactions auto-categorize.
        </p>
      </div>

      {/* Tab toggle */}
      <div className="flex border-b border-gray-200 mb-6">
        <button onClick={() => setActiveTab('unmapped')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'unmapped' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Unmapped
          {merchants.length > 0 && <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">{merchants.length}</span>}
        </button>
        <button onClick={() => setActiveTab('deposits')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'deposits' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Deposits
          {depositsLoaded && deposits.length > 0 && <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">{deposits.length}</span>}
        </button>
        <button onClick={() => setActiveTab('all')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'all' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          All Mappings
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* UNMAPPED TAB */}
      {activeTab === 'unmapped' && (
        <>
          {loading ? (
            <div className="flex items-center gap-3 text-gray-600">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Loading merchants...</span>
            </div>
          ) : merchants.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-green-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg font-medium text-gray-900 mb-1">All caught up!</p>
              <p className="text-gray-600">No unmapped merchants at this time.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <SortableHeader label="Merchant" column="merchant_name" sortConfig={unmappedSort} onSort={toggleSort(setUnmappedSort)} />
                    <SortableHeader label="Type" column="transaction_type" sortConfig={unmappedSort} onSort={toggleSort(setUnmappedSort)} />
                    <SortableHeader label="Date" column="transaction_date" sortConfig={unmappedSort} onSort={toggleSort(setUnmappedSort)} />
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Map To</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Select Entity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedMerchants.map((merchant) => {
                    const mType = mappingTypes[merchant.id];
                    const mTarget = mappingTargets[merchant.id];
                    const isSaving = savingId === merchant.id;

                    // Dynamic entity list based on selected mapping type
                    const entityOptions = mType === 'contractor' ? contractors
                      : mType === 'subscription' ? subscriptions
                      : mType === 'client' ? clients
                      : mType === 'agency' ? agencies
                      : mType === 'expense' ? expenseCategories
                      : mType === 'owner' ? ownerStaff
                      : [];

                    // Color theming per type
                    const typeColor = mType === 'contractor' ? 'blue' : mType === 'subscription' ? 'purple' : mType === 'client' ? 'green' : mType === 'agency' ? 'orange' : mType === 'expense' ? 'slate' : mType === 'owner' ? 'emerald' : 'gray';

                    const isExpanded = expandedMerchant === merchant.mercury_merchant_name;
                    const txns = merchantTransactions[merchant.mercury_merchant_name];
                    const isLoadingTxns = loadingTransactions === merchant.mercury_merchant_name;

                    return (
                      <React.Fragment key={merchant.id}>
                      <tr className="hover:bg-gray-50">
                        {/* Merchant name + suggestion hint */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => toggleMerchantExpand(merchant.mercury_merchant_name)}
                            className="inline-flex items-center gap-1.5 hover:text-blue-600 transition-colors"
                          >
                            <svg
                              className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="text-sm font-medium text-gray-900">{merchant.mercury_merchant_name}</span>
                          </button>
                          {merchant.suggested_subscription_name && (
                            <div className="flex items-center gap-1 mt-0.5 ml-5">
                              <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                                Suggested: {merchant.suggested_subscription_name}
                              </span>
                              <button
                                onClick={() => handlePromoteToExact(merchant)}
                                disabled={promoting === merchant.id}
                                className="text-[10px] text-purple-700 hover:text-purple-900 underline disabled:opacity-50"
                              >
                                {promoting === merchant.id ? '...' : 'Confirm'}
                              </button>
                            </div>
                          )}
                        </td>
                        {/* Transaction type badge */}
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          <span className={`px-2 py-0.5 rounded font-medium ${merchant.transaction_type === 'CREDIT' ? 'bg-green-100 text-green-700' : merchant.transaction_type === 'DEBIT' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                            {merchant.transaction_type ?? '--'}
                          </span>
                        </td>
                        {/* Transaction date */}
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {new Date(merchant.last_transaction_date ?? merchant.mapped_at).toLocaleDateString()}
                        </td>
                        {/* Map To type selector */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <select
                            value={mType ?? ''}
                            onChange={(e) => handleSetMappingType(merchant.id, e.target.value as MappingType | '')}
                            className="block w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">-- Select Type --</option>
                            <option value="contractor">Contractor</option>
                            <option value="agency">Agency</option>
                            <option value="subscription">Subscription</option>
                            <option value="client">Client</option>
                            <option value="expense">Expense</option>
                            <option value="owner">Owner</option>
                            <option value="per_transaction">Per-Transaction</option>
                          </select>
                        </td>
                        {/* Dynamic entity dropdown + New button */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {mType === 'per_transaction' ? (
                            <div className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-md">
                              Each transaction will be categorized by pattern-matching rules. Configure rules after mapping.
                            </div>
                          ) : mType ? (
                            <div>
                              <select
                                value={mTarget ?? ''}
                                onChange={(e) => handleSetMappingTarget(merchant.id, e.target.value)}
                                className={`block w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-${typeColor}-500 focus:border-${typeColor}-500`}
                              >
                                <option value="">-- Select {mType === 'contractor' ? 'Contractor' : mType === 'agency' ? 'Agency' : mType === 'subscription' ? 'Subscription' : mType === 'expense' ? 'Category' : mType === 'owner' ? 'Owner' : 'Client'} --</option>
                                {entityOptions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                              </select>
                              {mType === 'contractor' && (
                                <AddContractorModal
                                  defaultName={merchant.mercury_merchant_name}
                                  onCreated={(c) => handleEntityCreated(merchant.id, 'contractor', c)}
                                  trigger={<button type="button" className="mt-1 text-xs text-blue-600 hover:text-blue-800 hover:underline">+ New Contractor</button>}
                                />
                              )}
                              {mType === 'agency' && (
                                <AddAgencyModal
                                  onCreated={(a: { id: string; name: string }) => handleEntityCreated(merchant.id, 'agency', a)}
                                  trigger={<button type="button" className="mt-1 text-xs text-orange-600 hover:text-orange-800 hover:underline">+ New Agency</button>}
                                />
                              )}
                              {mType === 'subscription' && (
                                <AddSubscriptionModal
                                  defaultName={merchant.mercury_merchant_name}
                                  onCreated={(s) => handleEntityCreated(merchant.id, 'subscription', s)}
                                  trigger={<button type="button" className="mt-1 text-xs text-purple-600 hover:text-purple-800 hover:underline">+ New Subscription</button>}
                                />
                              )}
                              {mType === 'client' && (
                                <AddQuickClientModal
                                  defaultName={merchant.mercury_merchant_name}
                                  onCreated={(c) => handleEntityCreated(merchant.id, 'client', c)}
                                  trigger={<button type="button" className="mt-1 text-xs text-green-600 hover:text-green-800 hover:underline">+ New Client</button>}
                                />
                              )}
                              {mType === 'expense' && (
                                <>
                                  <AddExpenseCategoryModal
                                    organizationId={organizationId}
                                    onCreated={(c) => handleEntityCreated(merchant.id, 'expense', c)}
                                    trigger={<button type="button" className="mt-1 text-xs text-slate-600 hover:text-slate-800 hover:underline">+ New Category</button>}
                                  />
                                  <div className="mt-2">
                                    <label className="text-[10px] text-gray-500 uppercase font-medium">Allocate to Client (optional)</label>
                                    <select
                                      value={expenseClientIds[merchant.id] ?? ''}
                                      onChange={(e) => setExpenseClientIds((prev) => e.target.value ? { ...prev, [merchant.id]: e.target.value } : (() => { const u = { ...prev }; delete u[merchant.id]; return u; })())}
                                      className="block w-full mt-0.5 px-2 py-1 border border-gray-300 rounded-md text-xs focus:ring-slate-500 focus:border-slate-500"
                                    >
                                      <option value="">-- No Client --</option>
                                      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Select a type first</span>
                          )}
                        </td>
                        {/* Action button */}
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleSaveMapping(merchant.id)}
                            disabled={!mType || (mType !== 'per_transaction' && !mTarget) || isSaving}
                            className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                              mType === 'per_transaction' ? 'bg-amber-600 hover:bg-amber-700'
                              : mType === 'client' ? 'bg-green-600 hover:bg-green-700'
                              : mType === 'subscription' ? 'bg-purple-600 hover:bg-purple-700'
                              : mType === 'agency' ? 'bg-orange-600 hover:bg-orange-700'
                              : mType === 'expense' ? 'bg-slate-600 hover:bg-slate-700'
                              : mType === 'owner' ? 'bg-emerald-600 hover:bg-emerald-700'
                              : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                          >
                            {isSaving ? 'Saving...' : mType === 'per_transaction' ? 'Set Per-Transaction' : mTarget ? `Map ${mType === 'contractor' ? 'Contractor' : mType === 'agency' ? 'Agency' : mType === 'subscription' ? 'Subscription' : mType === 'expense' ? 'Expense' : mType === 'owner' ? 'Owner' : 'Client'}` : 'Map'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-4 py-0 bg-gray-50/70">
                            <div className="py-3 pl-6">
                              {isLoadingTxns ? (
                                <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                  Loading transactions...
                                </div>
                              ) : !txns || txns.length === 0 ? (
                                <p className="text-sm text-gray-400 italic py-2">No transactions found</p>
                              ) : (
                                <table className="min-w-full text-sm">
                                  <thead>
                                    <tr className="text-xs text-gray-500 uppercase">
                                      <th className="py-1 pr-4 text-left font-medium">Date</th>
                                      <th className="py-1 pr-4 text-left font-medium">Description</th>
                                      <th className="py-1 pr-4 text-right font-medium">Amount</th>
                                      <th className="py-1 text-left font-medium">Category</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {txns.map((txn) => (
                                      <tr key={txn.id} className="border-t border-gray-100">
                                        <td className="py-1.5 pr-4 text-gray-600 whitespace-nowrap">
                                          {new Date(txn.transaction_date).toLocaleDateString()}
                                        </td>
                                        <td className="py-1.5 pr-4 text-gray-600 truncate max-w-xs">
                                          {txn.description || '--'}
                                        </td>
                                        <td className={`py-1.5 pr-4 text-right whitespace-nowrap font-medium ${txn.is_credit ? 'text-green-600' : 'text-red-600'}`}>
                                          {txn.is_credit ? '+' : '-'}${Math.abs(txn.amount).toFixed(2)}
                                        </td>
                                        <td className="py-1.5 text-gray-500">
                                          {txn.category?.replace(/_/g, ' ') || '--'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* DEPOSITS TAB (T047) */}
      {activeTab === 'deposits' && (
        <>
          {depositsLoading ? (
            <div className="flex items-center gap-3 text-gray-600">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Loading deposits...</span>
            </div>
          ) : deposits.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-lg font-medium text-gray-900 mb-1">No unassociated deposits</p>
              <p className="text-gray-600">All Mercury deposits have been linked to clients.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <SortableHeader label="Counterparty" column="counterparty_name" sortConfig={depositsSort} onSort={toggleSort(setDepositsSort)} />
                    <SortableHeader label="Date" column="transaction_date" sortConfig={depositsSort} onSort={toggleSort(setDepositsSort)} />
                    <SortableHeader label="Amount" column="amount" sortConfig={depositsSort} onSort={toggleSort(setDepositsSort)} />
                    <SortableHeader label="Suggested Client" column="suggested_client" sortConfig={depositsSort} onSort={toggleSort(setDepositsSort)} />
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Link To Client</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedDeposits.map((deposit) => (
                    <tr key={deposit.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{deposit.counterparty_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(deposit.transaction_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">+${Number(deposit.amount).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {deposit.suggested_client_name ? (
                          <span className="inline-flex items-center gap-1">
                            {deposit.suggested_client_name}
                            <span className="text-xs text-gray-400">({((deposit.suggestion_confidence ?? 0) * 100).toFixed(0)}%)</span>
                          </span>
                        ) : <span className="text-gray-400 italic text-xs">No match</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select value={selectedClients[deposit.id] ?? deposit.suggested_client_id ?? ''} onChange={(e) => setSelectedClients((prev) => ({ ...prev, [deposit.id]: e.target.value }))} className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500">
                          <option value="">-- Select Client --</option>
                          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => {
                            const clientId = selectedClients[deposit.id] ?? deposit.suggested_client_id;
                            if (!clientId) { toast.error('Select a client first'); return; }
                            setLinkModalDeposit(deposit);
                          }}
                          disabled={!(selectedClients[deposit.id] ?? deposit.suggested_client_id)}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Link & Allocate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Link Deposit Modal */}
      {linkModalDeposit && (() => {
        const clientId = selectedClients[linkModalDeposit.id] ?? linkModalDeposit.suggested_client_id ?? '';
        const clientName = clients.find((c) => c.id === clientId)?.name ?? 'Unknown';
        const clientServicesList = (clients.find((c) => c.id === clientId) as any)?.client_services?.map((cs: any) => ({
          id: cs.service?.id ?? cs.service_id,
          name: cs.service?.name ?? 'Service',
        })) ?? [];
        return (
          <LinkDepositModal
            open={!!linkModalDeposit}
            onOpenChange={(open) => { if (!open) setLinkModalDeposit(null); }}
            deposit={{
              mercuryTransactionId: linkModalDeposit.mercury_transaction_id,
              amount: Number(linkModalDeposit.amount),
              transactionDate: linkModalDeposit.transaction_date,
              counterpartyName: linkModalDeposit.counterparty_name,
            }}
            clientId={clientId}
            clientName={clientName}
            clientServices={clientServicesList}
            organizationId={organizationId}
            feeDefaults={feeDefaults}
            onLinked={async (linkedPeriods) => {
              setDeposits((prev) => prev.filter((d) => d.id !== linkModalDeposit.id));
              setLinkModalDeposit(null);
              // Auto-refresh ROI for each period that received an allocation
              for (const p of linkedPeriods) {
                try {
                  await refreshClientROI({ client_id: clientId, month: p.month, year: p.year });
                } catch {
                  // Non-critical: ROI refresh can be done manually later
                }
              }
            }}
          />
        );
      })()}

      {/* ALL MAPPINGS TAB */}
      {activeTab === 'all' && (
        <>
          {allLoading ? (
            <div className="flex items-center gap-3 text-gray-600">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Loading all mappings...</span>
            </div>
          ) : allMappings.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">No merchant mappings found.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <SortableHeader label="Merchant" column="merchant" sortConfig={allSort} onSort={toggleSort(setAllSort)} />
                    <SortableHeader label="Mapped To" column="mapped_to" sortConfig={allSort} onSort={toggleSort(setAllSort)} />
                    <SortableHeader label="Type" column="type" sortConfig={allSort} onSort={toggleSort(setAllSort)} />
                    <SortableHeader label="Confidence" column="confidence" sortConfig={allSort} onSort={toggleSort(setAllSort)} />
                    <SortableHeader label="Last Seen" column="last_seen" sortConfig={allSort} onSort={toggleSort(setAllSort)} />
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedAllMappings.map((mapping) => {
                    const isPerTransaction = mapping.mapping_mode === 'PER_TRANSACTION';
                    const mappedName = mapping.contractor_name ?? mapping.agency_name ?? mapping.subscription_name ?? mapping.client_name ?? mapping.expense_category_name ?? mapping.staff_name;
                    const mappedType = isPerTransaction ? 'Per-Transaction' : mapping.contractor_name ? 'Contractor' : mapping.agency_name ? 'Agency' : mapping.subscription_name ? 'Subscription' : mapping.client_name ? 'Client' : mapping.expense_category_name ? 'Expense' : mapping.staff_name ? 'Owner' : '—';
                    const isExpanded = expandedMerchant === mapping.mercury_merchant_name;
                    const txns = merchantTransactions[mapping.mercury_merchant_name];
                    const isLoadingTxns = loadingTransactions === mapping.mercury_merchant_name;
                    return (
                      <React.Fragment key={mapping.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <button
                            onClick={() => toggleMerchantExpand(mapping.mercury_merchant_name)}
                            className="inline-flex items-center gap-1.5 hover:text-blue-600 transition-colors"
                          >
                            <svg
                              className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            {mapping.mercury_merchant_name}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {isPerTransaction ? (
                            <span className="text-amber-700 italic">Per-Transaction Rules</span>
                          ) : mapping.subscription_id && mapping.subscription_name ? (
                            <Link href={`/dashboard/subscriptions/${mapping.subscription_id}`} className="text-purple-600 hover:text-purple-800 hover:underline">
                              {mapping.subscription_name}
                            </Link>
                          ) : mappedName ? (
                            mappedName
                          ) : (
                            <span className="text-gray-400 italic">Unmapped</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${mappedType === 'Per-Transaction' ? 'bg-amber-100 text-amber-700' : mappedType === 'Subscription' ? 'bg-purple-100 text-purple-700' : mappedType === 'Contractor' ? 'bg-blue-100 text-blue-700' : mappedType === 'Agency' ? 'bg-green-100 text-green-700' : mappedType === 'Client' ? 'bg-emerald-100 text-emerald-700' : mappedType === 'Expense' ? 'bg-slate-100 text-slate-700' : mappedType === 'Owner' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500'}`}>
                            {mappedType}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${mapping.mapping_confidence === 'MANUAL' ? 'bg-blue-100 text-blue-700' : mapping.mapping_confidence === 'EXACT' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {confidenceLabel(mapping.mapping_confidence)}
                            {mapping.confidence_score != null && <span className="ml-1 opacity-75">{(Number(mapping.confidence_score) * 100).toFixed(0)}%</span>}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(mapping.last_transaction_date ?? mapping.mapped_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button onClick={() => handleUnmap(mapping.id, mapping.mercury_merchant_name)} disabled={unmapping === mapping.id} className="inline-flex items-center px-3 py-1.5 border border-red-300 text-xs font-medium rounded text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed">
                            {unmapping === mapping.id ? 'Removing...' : 'Unmap'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-6 py-0 bg-gray-50/70">
                            <div className="py-3 pl-6">
                              {isPerTransaction ? (
                                <PerTransactionRulesPanel
                                  merchantId={mapping.id}
                                  merchantName={mapping.mercury_merchant_name}
                                  organizationId={organizationId}
                                  contractors={contractors}
                                  subscriptions={subscriptions}
                                  agencies={allAgencies}
                                  clients={clients}
                                  expenseCategories={expenseCategories}
                                  ownerStaff={ownerStaff}
                                />
                              ) : isLoadingTxns ? (
                                <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                  Loading transactions...
                                </div>
                              ) : !txns || txns.length === 0 ? (
                                <p className="text-sm text-gray-400 italic py-2">No transactions found</p>
                              ) : (
                                <table className="min-w-full text-sm">
                                  <thead>
                                    <tr className="text-xs text-gray-500 uppercase">
                                      <th className="py-1 pr-4 text-left font-medium">Date</th>
                                      <th className="py-1 pr-4 text-left font-medium">Description</th>
                                      <th className="py-1 pr-4 text-right font-medium">Amount</th>
                                      <th className="py-1 text-left font-medium">Category</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {txns.map((txn) => (
                                      <tr key={txn.id} className="border-t border-gray-100">
                                        <td className="py-1.5 pr-4 text-gray-600 whitespace-nowrap">
                                          {new Date(txn.transaction_date).toLocaleDateString()}
                                        </td>
                                        <td className="py-1.5 pr-4 text-gray-600 truncate max-w-xs">
                                          {txn.description || '--'}
                                        </td>
                                        <td className={`py-1.5 pr-4 text-right whitespace-nowrap font-medium ${txn.is_credit ? 'text-green-600' : 'text-red-600'}`}>
                                          {txn.is_credit ? '+' : '-'}${Math.abs(txn.amount).toFixed(2)}
                                        </td>
                                        <td className="py-1.5 text-gray-500">
                                          {txn.category?.replace(/_/g, ' ') || '--'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
