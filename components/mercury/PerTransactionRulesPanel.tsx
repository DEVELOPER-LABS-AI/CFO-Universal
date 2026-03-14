/**
 * PerTransactionRulesPanel
 *
 * Inline panel shown below expanded PER_TRANSACTION merchant rows in All Mappings.
 * Two views:
 *   - Rules: Displays existing rules, allows CRUD, and supports pattern testing.
 *   - History: Lists all historical transactions with inline editing for category/entity assignment.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

interface Rule {
  id: string;
  rule_type: string;
  pattern: string;
  category: string;
  priority: number;
  is_active: boolean;
  contractor_id: string | null;
  subscription_id: string | null;
  agency_id: string | null;
  client_id: string | null;
  expense_category_id: string | null;
  staff_id: string | null;
  contractor_name: string | null;
  subscription_name: string | null;
  agency_name: string | null;
  client_name: string | null;
  expense_category_name: string | null;
  staff_name: string | null;
}

interface Entity {
  id: string;
  name: string;
}

interface MerchantTransaction {
  id: string;
  amount: number;
  transaction_date: string;
  description: string | null;
  is_credit: boolean;
  category: string;
  contractor_id: string | null;
  client_id: string | null;
  agency_id: string | null;
  subscription_id: string | null;
  expense_category_id: string | null;
  staff_id: string | null;
  entity_name: string | null;
  entity_type: EntityType | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PerTransactionRulesPanelProps {
  merchantId: string;
  merchantName: string;
  organizationId: string;
  contractors: Entity[];
  subscriptions: Entity[];
  agencies: Entity[];
  clients: Entity[];
  expenseCategories: Entity[];
  ownerStaff: Entity[];
}

type EntityType = 'contractor' | 'subscription' | 'agency' | 'client' | 'expense' | 'owner' | '';
type PanelView = 'rules' | 'history';

const CATEGORY_OPTIONS = [
  'CONTRACTOR_COST',
  'SUBSCRIPTION',
  'TOOLS',
  'PAYROLL',
  'OVERHEAD',
  'MARKETING',
  'TRANSFER',
  'OTHER',
];

const ENTITY_TYPE_LABELS: Record<string, string> = {
  contractor: 'Contractor',
  subscription: 'Subscription',
  agency: 'Agency',
  client: 'Client',
  expense: 'Expense',
  owner: 'Owner',
};

export function PerTransactionRulesPanel({
  merchantId,
  merchantName,
  organizationId,
  contractors,
  subscriptions,
  agencies,
  clients,
  expenseCategories,
  ownerStaff,
}: PerTransactionRulesPanelProps) {
  // View toggle
  const [activeView, setActiveView] = useState<PanelView>('rules');

  // Rules state
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);

  // Add rule form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRuleType, setNewRuleType] = useState<string>('DESCRIPTION_KEYWORD');
  const [newPattern, setNewPattern] = useState('');
  const [newCategory, setNewCategory] = useState<string>('OTHER');
  const [newPriority, setNewPriority] = useState(100);
  const [newEntityType, setNewEntityType] = useState<EntityType>('');
  const [newEntityId, setNewEntityId] = useState('');
  const [saving, setSaving] = useState(false);

  // Test state
  const [testResults, setTestResults] = useState<{ matched_count: number; total_tested: number; transactions: any[] } | null>(null);
  const [testing, setTesting] = useState(false);

  // Edit state (unused but kept for future inline rule editing)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Transaction history state
  const [transactions, setTransactions] = useState<MerchantTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txPage, setTxPage] = useState(1);
  const [txPagination, setTxPagination] = useState<Pagination | null>(null);

  // Per-row inline editing state
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState<string>('');
  const [editEntityType, setEditEntityType] = useState<EntityType>('');
  const [editEntityId, setEditEntityId] = useState<string>('');
  const [savingTxId, setSavingTxId] = useState<string | null>(null);

  useEffect(() => {
    loadRules();
  }, [merchantId]);

  const loadRules = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/mercury/merchants/${merchantId}/rules?organizationId=${organizationId}`
      );
      if (!res.ok) throw new Error('Failed to load rules');
      const data = await res.json();
      setRules(data.rules ?? []);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = useCallback(async (pageNum: number) => {
    setTxLoading(true);
    try {
      const res = await fetch(
        `/api/mercury/merchants/transactions?organizationId=${organizationId}&merchantName=${encodeURIComponent(merchantName)}&page=${pageNum}&limit=25`
      );
      if (!res.ok) throw new Error('Failed to load transactions');
      const data = await res.json();
      setTransactions(data.transactions);
      setTxPagination(data.pagination);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to load transactions');
    } finally {
      setTxLoading(false);
    }
  }, [organizationId, merchantName]);

  useEffect(() => {
    if (activeView === 'history') {
      setEditingTxId(null);
      loadTransactions(txPage);
    }
  }, [activeView, txPage, loadTransactions]);

  const handleAddRule = async () => {
    if (!newPattern.trim()) {
      toast.error('Pattern is required');
      return;
    }

    try {
      setSaving(true);
      const body: Record<string, any> = {
        organizationId,
        rule_type: newRuleType,
        pattern: newPattern,
        category: newCategory,
        priority: newPriority,
      };

      // Map entity type to the correct FK field
      if (newEntityType === 'contractor' && newEntityId) body.contractorId = newEntityId;
      if (newEntityType === 'subscription' && newEntityId) body.subscriptionId = newEntityId;
      if (newEntityType === 'agency' && newEntityId) body.agencyId = newEntityId;
      if (newEntityType === 'client' && newEntityId) body.clientId = newEntityId;
      if (newEntityType === 'expense' && newEntityId) body.expenseCategoryId = newEntityId;
      if (newEntityType === 'owner' && newEntityId) body.staffId = newEntityId;

      const res = await fetch(`/api/mercury/merchants/${merchantId}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create rule');
      }

      const data = await res.json();
      toast.success(`Rule created. ${data.recategorized_count} transactions recategorized.`);

      // Reset form and reload
      setNewPattern('');
      setNewEntityType('');
      setNewEntityId('');
      setShowAddForm(false);
      setTestResults(null);
      await loadRules();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to create rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const res = await fetch(
        `/api/mercury/merchants/${merchantId}/rules/${ruleId}?organizationId=${organizationId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Failed to delete rule');
      const data = await res.json();
      toast.success(`Rule deactivated. ${data.recategorized_count} transactions recategorized.`);
      await loadRules();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to delete rule');
    }
  };

  const handleTestPattern = async () => {
    if (!newPattern.trim()) {
      toast.error('Enter a pattern to test');
      return;
    }

    try {
      setTesting(true);
      const res = await fetch(`/api/mercury/merchants/${merchantId}/rules/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          rule_type: newRuleType,
          pattern: newPattern,
        }),
      });
      if (!res.ok) throw new Error('Failed to test pattern');
      const data = await res.json();
      setTestResults(data);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to test pattern');
    } finally {
      setTesting(false);
    }
  };

  /** Get entity list based on type */
  const getEntityOptions = (type: EntityType): Entity[] => {
    switch (type) {
      case 'contractor': return contractors;
      case 'subscription': return subscriptions;
      case 'agency': return agencies;
      case 'client': return clients;
      case 'expense': return expenseCategories;
      case 'owner': return ownerStaff;
      default: return [];
    }
  };

  /** Get display name for an entity mapping */
  const getEntityDisplay = (rule: Rule): string => {
    return rule.contractor_name || rule.subscription_name || rule.agency_name
      || rule.client_name || rule.expense_category_name || rule.staff_name || '--';
  };

  /** Get entity type label */
  const getEntityTypeLabel = (rule: Rule): string => {
    if (rule.contractor_id) return 'Contractor';
    if (rule.subscription_id) return 'Subscription';
    if (rule.agency_id) return 'Agency';
    if (rule.client_id) return 'Client';
    if (rule.expense_category_id) return 'Expense';
    if (rule.staff_id) return 'Owner';
    return '--';
  };

  // --- Transaction History handlers ---

  const handleStartEdit = (tx: MerchantTransaction) => {
    setEditingTxId(tx.id);
    setEditCategory(tx.category);
    setEditEntityType(tx.entity_type ?? '');
    setEditEntityId(
      tx.contractor_id ?? tx.subscription_id ?? tx.agency_id
      ?? tx.client_id ?? tx.expense_category_id ?? tx.staff_id ?? ''
    );
  };

  const handleCancelEdit = () => {
    setEditingTxId(null);
    setEditCategory('');
    setEditEntityType('');
    setEditEntityId('');
  };

  const handleSaveTransaction = async (txId: string) => {
    try {
      setSavingTxId(txId);
      const body: Record<string, any> = {
        expenseId: txId,
        category: editCategory,
        organizationId,
      };

      // Map entity type to correct FK key
      if (editEntityType === 'contractor' && editEntityId) body.contractorId = editEntityId;
      else if (editEntityType === 'subscription' && editEntityId) body.subscriptionId = editEntityId;
      else if (editEntityType === 'agency' && editEntityId) body.agencyId = editEntityId;
      else if (editEntityType === 'client' && editEntityId) body.clientId = editEntityId;
      else if (editEntityType === 'expense' && editEntityId) body.expenseCategoryId = editEntityId;
      else if (editEntityType === 'owner' && editEntityId) body.staffId = editEntityId;

      const res = await fetch('/api/mercury/expenses/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      toast.success('Transaction updated');
      handleCancelEdit();
      await loadTransactions(txPage);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to save transaction');
    } finally {
      setSavingTxId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Loading rules...
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-semibold text-gray-800">
            &ldquo;{merchantName}&rdquo;
          </h4>
          <div className="flex border border-gray-200 rounded-md overflow-hidden text-xs">
            <button
              onClick={() => setActiveView('rules')}
              className={`px-3 py-1 font-medium transition-colors ${
                activeView === 'rules'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              Rules
            </button>
            <button
              onClick={() => setActiveView('history')}
              className={`px-3 py-1 font-medium transition-colors ${
                activeView === 'history'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              History
            </button>
          </div>
        </div>
        {activeView === 'rules' && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-xs font-medium text-amber-700 hover:text-amber-900 border border-amber-300 px-2.5 py-1 rounded hover:bg-amber-50"
          >
            {showAddForm ? 'Cancel' : '+ Add Rule'}
          </button>
        )}
      </div>

      {/* ==================== RULES VIEW ==================== */}
      {activeView === 'rules' && (
        <>
          {/* Existing rules table */}
          {rules.length > 0 ? (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b border-gray-200">
                  <th className="py-1.5 pr-3 text-left font-medium">Priority</th>
                  <th className="py-1.5 pr-3 text-left font-medium">Rule Type</th>
                  <th className="py-1.5 pr-3 text-left font-medium">Pattern</th>
                  <th className="py-1.5 pr-3 text-left font-medium">Category</th>
                  <th className="py-1.5 pr-3 text-left font-medium">Maps To</th>
                  <th className="py-1.5 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.filter((r) => r.is_active).map((rule) => (
                  <tr key={rule.id} className="border-t border-gray-100">
                    <td className="py-1.5 pr-3 text-gray-600">{rule.priority}</td>
                    <td className="py-1.5 pr-3">
                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                        {rule.rule_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 font-mono text-xs text-gray-700">{rule.pattern}</td>
                    <td className="py-1.5 pr-3 text-gray-600">{rule.category.replace(/_/g, ' ')}</td>
                    <td className="py-1.5 pr-3">
                      <span className="text-xs text-gray-600">
                        {getEntityTypeLabel(rule)}: {getEntityDisplay(rule)}
                      </span>
                    </td>
                    <td className="py-1.5">
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-xs text-red-600 hover:text-red-800 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-400 italic">No rules configured yet. Add a rule to start categorizing transactions.</p>
          )}

          {/* Add Rule Form */}
          {showAddForm && (
            <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/30 space-y-3">
              <h5 className="text-xs font-semibold text-amber-800 uppercase">New Rule</h5>

              <div className="grid grid-cols-2 gap-3">
                {/* Rule Type */}
                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-medium block mb-0.5">Rule Type</label>
                  <select
                    value={newRuleType}
                    onChange={(e) => setNewRuleType(e.target.value)}
                    className="block w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="DESCRIPTION_KEYWORD">Description Keyword</option>
                    <option value="AMOUNT_RANGE">Amount Range</option>
                    <option value="MERCHANT_NAME">Merchant Name</option>
                  </select>
                </div>

                {/* Pattern */}
                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-medium block mb-0.5">
                    Pattern {newRuleType === 'AMOUNT_RANGE' ? '(min-max)' : '(regex)'}
                  </label>
                  <input
                    type="text"
                    value={newPattern}
                    onChange={(e) => setNewPattern(e.target.value)}
                    placeholder={newRuleType === 'AMOUNT_RANGE' ? '1000-5000' : 'atlas|annual'}
                    className="block w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-medium block mb-0.5">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="block w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-medium block mb-0.5">Priority</label>
                  <input
                    type="number"
                    value={newPriority}
                    onChange={(e) => setNewPriority(parseInt(e.target.value) || 100)}
                    className="block w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                  />
                </div>

                {/* Entity Type */}
                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-medium block mb-0.5">Map To (optional)</label>
                  <select
                    value={newEntityType}
                    onChange={(e) => { setNewEntityType(e.target.value as EntityType); setNewEntityId(''); }}
                    className="block w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">-- No Entity --</option>
                    <option value="contractor">Contractor</option>
                    <option value="subscription">Subscription</option>
                    <option value="agency">Agency</option>
                    <option value="client">Client</option>
                    <option value="expense">Expense Category</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>

                {/* Entity Selection */}
                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-medium block mb-0.5">Entity</label>
                  <select
                    value={newEntityId}
                    onChange={(e) => setNewEntityId(e.target.value)}
                    disabled={!newEntityType}
                    className="block w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm disabled:bg-gray-100"
                  >
                    <option value="">-- Select --</option>
                    {getEntityOptions(newEntityType).map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleTestPattern}
                  disabled={!newPattern.trim() || testing}
                  className="text-xs font-medium text-gray-700 border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-100 disabled:opacity-50"
                >
                  {testing ? 'Testing...' : 'Test Pattern'}
                </button>
                <button
                  onClick={handleAddRule}
                  disabled={!newPattern.trim() || saving}
                  className="text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Rule'}
                </button>
              </div>

              {/* Test Results */}
              {testResults && (
                <div className="border border-gray-200 rounded p-3 bg-white mt-2">
                  <p className="text-xs text-gray-600 mb-2">
                    Matched <span className="font-semibold text-amber-700">{testResults.matched_count}</span> of {testResults.total_tested} recent transactions
                  </p>
                  {testResults.transactions.length > 0 && (
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 uppercase">
                          <th className="py-1 pr-3 text-left font-medium">Date</th>
                          <th className="py-1 pr-3 text-left font-medium">Description</th>
                          <th className="py-1 pr-3 text-right font-medium">Amount</th>
                          <th className="py-1 text-left font-medium">Match</th>
                        </tr>
                      </thead>
                      <tbody>
                        {testResults.transactions.map((tx: any) => (
                          <tr key={tx.id} className="border-t border-gray-100">
                            <td className="py-1 pr-3 text-gray-500">{new Date(tx.transaction_date).toLocaleDateString()}</td>
                            <td className="py-1 pr-3 text-gray-600 truncate max-w-[200px]">{tx.description || '--'}</td>
                            <td className="py-1 pr-3 text-right text-gray-600">${Math.abs(tx.amount).toFixed(2)}</td>
                            <td className="py-1">
                              {tx.matched ? (
                                <span className="text-green-600 font-medium">Yes</span>
                              ) : (
                                <span className="text-gray-400">No</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ==================== HISTORY VIEW ==================== */}
      {activeView === 'history' && (
        <>
          {txLoading ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading transactions...
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-2">No transactions found for this merchant.</p>
          ) : (
            <>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase border-b border-gray-200">
                    <th className="py-1.5 pr-3 text-left font-medium">Date</th>
                    <th className="py-1.5 pr-3 text-left font-medium">Description</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Amount</th>
                    <th className="py-1.5 pr-3 text-left font-medium">Category</th>
                    <th className="py-1.5 pr-3 text-left font-medium">Assigned To</th>
                    <th className="py-1.5 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const isEditing = editingTxId === tx.id;
                    const isSaving = savingTxId === tx.id;

                    return (
                      <tr key={tx.id} className="border-t border-gray-100">
                        {/* Date - always read-only */}
                        <td className="py-1.5 pr-3 text-gray-600 whitespace-nowrap">
                          {new Date(tx.transaction_date).toLocaleDateString()}
                        </td>

                        {/* Description - always read-only */}
                        <td className="py-1.5 pr-3 text-gray-600 truncate max-w-[180px]" title={tx.description || undefined}>
                          {tx.description || '--'}
                        </td>

                        {/* Amount - always read-only */}
                        <td className={`py-1.5 pr-3 text-right whitespace-nowrap font-medium ${tx.is_credit ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.is_credit ? '+' : '-'}${Math.abs(tx.amount).toFixed(2)}
                        </td>

                        {/* Category */}
                        <td className="py-1.5 pr-3">
                          {isEditing ? (
                            <select
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              className="block w-full px-1.5 py-1 border border-gray-300 rounded text-xs"
                            >
                              {CATEGORY_OPTIONS.map((cat) => (
                                <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-gray-600">
                              {tx.category.replace(/_/g, ' ')}
                            </span>
                          )}
                        </td>

                        {/* Entity assignment */}
                        <td className="py-1.5 pr-3">
                          {isEditing ? (
                            <div className="flex gap-1">
                              <select
                                value={editEntityType}
                                onChange={(e) => { setEditEntityType(e.target.value as EntityType); setEditEntityId(''); }}
                                className="block w-24 px-1 py-1 border border-gray-300 rounded text-xs"
                              >
                                <option value="">None</option>
                                <option value="contractor">Contractor</option>
                                <option value="subscription">Subscription</option>
                                <option value="agency">Agency</option>
                                <option value="client">Client</option>
                                <option value="expense">Expense</option>
                                <option value="owner">Owner</option>
                              </select>
                              {editEntityType && (
                                <select
                                  value={editEntityId}
                                  onChange={(e) => setEditEntityId(e.target.value)}
                                  className="block w-32 px-1 py-1 border border-gray-300 rounded text-xs"
                                >
                                  <option value="">-- Select --</option>
                                  {getEntityOptions(editEntityType).map((e) => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-600">
                              {tx.entity_type && tx.entity_name
                                ? `${ENTITY_TYPE_LABELS[tx.entity_type] || tx.entity_type}: ${tx.entity_name}`
                                : <span className="text-gray-400 italic">Unassigned</span>
                              }
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-1.5 whitespace-nowrap">
                          {isEditing ? (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleSaveTransaction(tx.id)}
                                disabled={isSaving}
                                className="text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 px-2 py-0.5 rounded disabled:opacity-50"
                              >
                                {isSaving ? '...' : 'Save'}
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={isSaving}
                                className="text-xs text-gray-500 hover:text-gray-700 hover:underline disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartEdit(tx)}
                              className="text-xs text-amber-700 hover:text-amber-900 hover:underline"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              {txPagination && txPagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-3 text-xs text-gray-500">
                  <span>
                    Page {txPagination.page} of {txPagination.totalPages} ({txPagination.total} transactions)
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={txPage <= 1}
                      onClick={() => setTxPage((p) => p - 1)}
                      className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      disabled={txPage >= txPagination.totalPages}
                      onClick={() => setTxPage((p) => p + 1)}
                      className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
