/**
 * Mercury Expenses Content (Client Component)
 *
 * Tabs: "Uncategorized" | "All Expenses"
 * Receives organizationId from server component wrapper.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

interface Expense {
  id: string;
  amount: number;
  transaction_date: string;
  description: string | null;
  category: string;
  contractor_id: string | null;
  client_id: string | null;
  agency_id: string | null;
  mercury_transaction_id: string | null;
  merchant_name: string | null;
  contractor: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
  agency: { id: string; name: string } | null;
}

interface Contractor {
  id: string;
  name: string;
  engagement_type?: string;
}

interface Client {
  id: string;
  name: string;
}

const EXPENSE_CATEGORIES = [
  { value: 'CONTRACTOR_COST', label: 'Contractor Cost' },
  { value: 'SUBSCRIPTION', label: 'Subscription' },
  { value: 'TOOLS', label: 'Tools' },
  { value: 'PAYROLL', label: 'Payroll' },
  { value: 'OVERHEAD', label: 'Overhead' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'OTHER', label: 'Other' },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, c.label])
);

const getCategoryAssociations = (category: string) => {
  switch (category) {
    case 'CONTRACTOR_COST':
      return { needsContractor: true, needsClient: false };
    case 'SUBSCRIPTION':
    case 'TOOLS':
      return { needsContractor: false, needsClient: true };
    default:
      return { needsContractor: false, needsClient: false };
  }
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

type Tab = 'uncategorized' | 'all';

interface MercuryExpensesContentProps {
  organizationId: string;
}

export function MercuryExpensesContent({ organizationId }: MercuryExpensesContentProps) {
  const [activeTab, setActiveTab] = useState<Tab>('uncategorized');

  // Uncategorized tab
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Record<string, string>>({});
  const [selectedContractors, setSelectedContractors] = useState<Record<string, string>>({});
  const [selectedClients, setSelectedClients] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // All expenses tab
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);
  const [reSelectedCategories, setReSelectedCategories] = useState<Record<string, string>>({});
  const [reSelectedContractors, setReSelectedContractors] = useState<Record<string, string>>({});
  const [reSelectedClients, setReSelectedClients] = useState<Record<string, string>>({});
  const [reSaving, setReSaving] = useState<string | null>(null);
  const [recatOpen, setRecatOpen] = useState<string | null>(null);

  useEffect(() => {
    if (organizationId) loadExpenses();
  }, [organizationId]);

  useEffect(() => {
    if (activeTab === 'all' && organizationId && !allLoaded) loadAllExpenses();
  }, [activeTab, organizationId]);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/mercury/expenses/uncategorized?organizationId=${organizationId}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load expenses');
      }
      const data = await response.json();
      setExpenses(data.uncategorized_expenses);
      setContractors(data.contractors || []);
      setClients(data.clients || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const loadAllExpenses = async () => {
    try {
      setAllLoading(true);
      const response = await fetch(`/api/mercury/expenses/all?organizationId=${organizationId}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load expenses');
      }
      const data = await response.json();
      setAllExpenses(data.expenses);
      if (contractors.length === 0) setContractors(data.contractors || []);
      if (clients.length === 0) setClients(data.clients || []);
      setAllLoaded(true);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to load expenses');
    } finally {
      setAllLoading(false);
    }
  };

  const handleSelectCategory = (expenseId: string, category: string) => {
    setSelectedCategories((prev) => ({ ...prev, [expenseId]: category }));
    setSelectedContractors((prev) => { const u = { ...prev }; delete u[expenseId]; return u; });
    setSelectedClients((prev) => { const u = { ...prev }; delete u[expenseId]; return u; });
  };

  const handleCategorize = async (expenseId: string, isReCat = false) => {
    const catMap = isReCat ? reSelectedCategories : selectedCategories;
    const contractorMap = isReCat ? reSelectedContractors : selectedContractors;
    const clientMap = isReCat ? reSelectedClients : selectedClients;

    const category = catMap[expenseId];
    if (!category) { toast.error('Please select a category'); return; }
    if (category === 'CONTRACTOR_COST' && !contractorMap[expenseId]) {
      toast.error('Please select a contractor for contractor cost expenses');
      return;
    }

    try {
      if (isReCat) setReSaving(expenseId); else setSaving(expenseId);

      const requestBody: Record<string, string> = { expenseId, category, organizationId };
      if (contractorMap[expenseId]) requestBody.contractorId = contractorMap[expenseId];
      if (clientMap[expenseId]) requestBody.clientId = clientMap[expenseId];

      const response = await fetch('/api/mercury/expenses/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to categorize expense');
      }

      toast.success('Expense categorized successfully');

      if (isReCat) {
        setAllExpenses((prev) =>
          prev.map((e) =>
            e.id === expenseId
              ? {
                  ...e,
                  category,
                  contractor_id: contractorMap[expenseId] ?? null,
                  client_id: clientMap[expenseId] ?? null,
                  contractor: contractorMap[expenseId]
                    ? { id: contractorMap[expenseId], name: contractors.find((c) => c.id === contractorMap[expenseId])?.name ?? '' }
                    : null,
                  client: clientMap[expenseId]
                    ? { id: clientMap[expenseId], name: clients.find((c) => c.id === clientMap[expenseId])?.name ?? '' }
                    : null,
                }
              : e
          )
        );
        setReSelectedCategories((prev) => { const u = { ...prev }; delete u[expenseId]; return u; });
        setReSelectedContractors((prev) => { const u = { ...prev }; delete u[expenseId]; return u; });
        setReSelectedClients((prev) => { const u = { ...prev }; delete u[expenseId]; return u; });
        setRecatOpen(null);
        loadExpenses();
      } else {
        setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
        setSelectedCategories((prev) => { const u = { ...prev }; delete u[expenseId]; return u; });
        setSelectedContractors((prev) => { const u = { ...prev }; delete u[expenseId]; return u; });
        setSelectedClients((prev) => { const u = { ...prev }; delete u[expenseId]; return u; });
        setAllLoaded(false);
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to categorize expense');
    } finally {
      if (isReCat) setReSaving(null); else setSaving(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mercury Expenses</h1>
        <p className="text-gray-600 mt-1">Categorize individual transactions: payroll, overhead, marketing, and other one-off costs.</p>
      </div>

      <div className="flex border-b border-gray-200 mb-6">
        <button onClick={() => setActiveTab('uncategorized')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'uncategorized' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Uncategorized
          {expenses.length > 0 && <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">{expenses.length}</span>}
        </button>
        <button onClick={() => setActiveTab('all')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'all' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          All Expenses
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* UNCATEGORIZED TAB */}
      {activeTab === 'uncategorized' && (
        <>
          {loading ? (
            <div className="flex items-center gap-3 text-gray-600">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Loading expenses...</span>
            </div>
          ) : expenses.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-green-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg font-medium text-gray-900 mb-1">All caught up!</p>
              <p className="text-gray-600">No uncategorized expenses at this time.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Merchant</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contractor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {expenses.map((expense) => {
                      const selectedCategory = selectedCategories[expense.id];
                      const associations = selectedCategory ? getCategoryAssociations(selectedCategory) : { needsContractor: false, needsClient: false };
                      return (
                        <tr key={expense.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(expense.transaction_date).toLocaleDateString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{expense.merchant_name || 'Unknown'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600"><div className="max-w-xs truncate" title={expense.description || ''}>{expense.description || '—'}</div></td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatCurrency(expense.amount)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select value={selectedCategories[expense.id] || ''} onChange={(e) => handleSelectCategory(expense.id, e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500">
                              <option value="">-- Select Category --</option>
                              {EXPENSE_CATEGORIES.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {associations.needsContractor ? (
                              <select value={selectedContractors[expense.id] || ''} onChange={(e) => setSelectedContractors((prev) => ({ ...prev, [expense.id]: e.target.value }))} className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500">
                                <option value="">-- Select Contractor --</option>
                                {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            ) : <span className="text-sm text-gray-400">—</span>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {associations.needsClient ? (
                              <select value={selectedClients[expense.id] || ''} onChange={(e) => setSelectedClients((prev) => ({ ...prev, [expense.id]: e.target.value }))} className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500">
                                <option value="">-- Select Client (Optional) --</option>
                                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            ) : <span className="text-sm text-gray-400">—</span>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button onClick={() => handleCategorize(expense.id, false)} disabled={!selectedCategories[expense.id] || saving === expense.id} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                              {saving === expense.id ? 'Saving...' : 'Categorize'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ALL EXPENSES TAB */}
      {activeTab === 'all' && (
        <>
          {allLoading ? (
            <div className="flex items-center gap-3 text-gray-600">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Loading all expenses...</span>
            </div>
          ) : allExpenses.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">No Mercury expenses found.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Merchant</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Linked To</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {allExpenses.map((expense) => {
                      const linkedName = expense.contractor?.name ?? expense.agency?.name ?? expense.client?.name ?? null;
                      const linkedType = expense.contractor ? 'Contractor' : expense.agency ? 'Agency' : expense.client ? 'Client' : null;
                      const isOpen = recatOpen === expense.id;
                      const reCategory = reSelectedCategories[expense.id];
                      const reAssoc = reCategory ? getCategoryAssociations(reCategory) : null;
                      return (
                        <tr key={expense.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(expense.transaction_date).toLocaleDateString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{expense.merchant_name || 'Unknown'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatCurrency(expense.amount)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${expense.category === 'OTHER' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>
                              {CATEGORY_LABELS[expense.category] ?? expense.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {linkedName ? <span>{linkedName} <span className="text-xs text-gray-400">({linkedType})</span></span> : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {isOpen ? (
                              <div className="flex flex-col gap-2 min-w-[200px]">
                                <select value={reCategory || ''} onChange={(e) => setReSelectedCategories((prev) => ({ ...prev, [expense.id]: e.target.value }))} className="block w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-blue-500 focus:border-blue-500">
                                  <option value="">-- Category --</option>
                                  {EXPENSE_CATEGORIES.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                                </select>
                                {reAssoc?.needsContractor && (
                                  <select value={reSelectedContractors[expense.id] || ''} onChange={(e) => setReSelectedContractors((prev) => ({ ...prev, [expense.id]: e.target.value }))} className="block w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-blue-500 focus:border-blue-500">
                                    <option value="">-- Contractor --</option>
                                    {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                  </select>
                                )}
                                {reAssoc?.needsClient && (
                                  <select value={reSelectedClients[expense.id] || ''} onChange={(e) => setReSelectedClients((prev) => ({ ...prev, [expense.id]: e.target.value }))} className="block w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-blue-500 focus:border-blue-500">
                                    <option value="">-- Client (Optional) --</option>
                                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                  </select>
                                )}
                                <div className="flex gap-2">
                                  <button onClick={() => handleCategorize(expense.id, true)} disabled={!reCategory || reSaving === expense.id} className="px-2 py-1 text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {reSaving === expense.id ? 'Saving...' : 'Save'}
                                  </button>
                                  <button onClick={() => { setRecatOpen(null); setReSelectedCategories((prev) => { const u = { ...prev }; delete u[expense.id]; return u; }); }} className="px-2 py-1 text-xs font-medium rounded text-gray-600 border border-gray-300 hover:bg-gray-50">
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setRecatOpen(expense.id)} className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 hover:bg-gray-50">
                                Re-categorize
                              </button>
                            )}
                          </td>
                        </tr>
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
