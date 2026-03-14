/**
 * MerchantsSection Component
 *
 * Embeddable component for merchant mapping within an accordion.
 * Tabs: "Unmapped" (needs mapping) | "All Mappings" (view + unmap any entry)
 * Receives organizationId as a prop instead of reading from search params.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AddSubscriptionModal } from '@/components/subscriptions/AddSubscriptionModal';
import { AddContractorModal } from '@/components/contractors/AddContractorModal';
import { getErrorMessage } from '@/lib/utils/error';

/** Unmapped merchant returned by the unmapped API. */
interface UnmappedMerchant {
  id: string;
  mercury_merchant_name: string;
  normalized_merchant_name: string;
  mapped_at: Date;
}

/** A single mapping entry returned by the all-mappings API. */
interface MappingEntry {
  id: string;
  mercury_merchant_name: string;
  normalized_merchant_name: string;
  mapping_confidence: string;
  confidence_score: number | null;
  mapped_by: string;
  mapped_at: string;
  contractor_id: string | null;
  agency_id: string | null;
  subscription_id: string | null;
  contractor_name: string | null;
  agency_name: string | null;
  subscription_name: string | null;
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

interface MerchantsSectionProps {
  organizationId: string;
}

/**
 * Renders merchant mapping UI with Radix Tabs for unmapped / all-mappings views.
 *
 * @param props.organizationId - The current organization identifier.
 */
export function MerchantsSection({ organizationId }: MerchantsSectionProps) {
  // --- Unmapped tab state ---
  const [merchants, setMerchants] = useState<UnmappedMerchant[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMappings, setSelectedMappings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // --- Subscription mapping state ---
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [selectedSubscriptions, setSelectedSubscriptions] = useState<Record<string, string>>({});
  const [savingSub, setSavingSub] = useState<string | null>(null);

  // --- All mappings tab state ---
  const [allMappings, setAllMappings] = useState<MappingEntry[]>([]);
  const [allAgencies, setAllAgencies] = useState<Agency[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);
  const [unmapping, setUnmapping] = useState<string | null>(null);

  // ----------------------------------------------------------------
  // Data fetchers
  // ----------------------------------------------------------------

  /** Loads unmapped merchants and the list of available contractors. */
  const loadMerchants = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/mercury/merchants/unmapped?organizationId=${organizationId}`
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load merchants');
      }
      const data = await response.json();
      setMerchants(data.unmapped_merchants);
      setContractors(data.contractors);
      setSubscriptions(data.subscriptions ?? []);
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Failed to load merchants');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  /** Loads every merchant mapping (used by the "All Mappings" tab). */
  const loadAllMappings = useCallback(async () => {
    try {
      setAllLoading(true);
      const response = await fetch(
        `/api/mercury/merchants/all?organizationId=${organizationId}`
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load mappings');
      }
      const data = await response.json();
      setAllMappings(data.mappings);
      setAllAgencies(data.agencies);
      if (contractors.length === 0) {
        setContractors(data.contractors);
      }
      setAllLoaded(true);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to load mappings');
    } finally {
      setAllLoading(false);
    }
  }, [organizationId, contractors.length]);

  // Load unmapped merchants on mount.
  useEffect(() => {
    if (organizationId) {
      loadMerchants();
    }
  }, [organizationId, loadMerchants]);

  // ----------------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------------

  /** Selects a contractor for a given merchant in the unmapped table. */
  const handleSelectContractor = (merchantId: string, contractorId: string) => {
    setSelectedMappings((prev) => ({ ...prev, [merchantId]: contractorId }));
    if (contractorId) {
      setSelectedSubscriptions((prev) => { const u = { ...prev }; delete u[merchantId]; return u; });
    }
  };

  /** Selects a subscription for a given merchant (mutually exclusive with contractor). */
  const handleSelectSubscription = (merchantId: string, subscriptionId: string) => {
    setSelectedSubscriptions((prev) => ({ ...prev, [merchantId]: subscriptionId }));
    if (subscriptionId) {
      setSelectedMappings((prev) => { const u = { ...prev }; delete u[merchantId]; return u; });
    }
  };

  /** Adds a newly created contractor to the dropdown and auto-selects it. */
  const handleContractorCreated = (merchantId: string, contractor: { id: string; name: string }) => {
    setContractors((prev) => [...prev, { id: contractor.id, name: contractor.name }].sort((a, b) => a.name.localeCompare(b.name)));
    handleSelectContractor(merchantId, contractor.id);
  };

  /** Adds a newly created subscription to the dropdown and auto-selects it. */
  const handleSubscriptionCreated = (merchantId: string, subscription: { id: string; name: string }) => {
    setSubscriptions((prev) => [...prev, { id: subscription.id, name: subscription.name }].sort((a, b) => a.name.localeCompare(b.name)));
    handleSelectSubscription(merchantId, subscription.id);
  };

  /** Persists a manual merchant -> subscription mapping. */
  const handleSaveSubscriptionMapping = async (merchantId: string) => {
    const subscriptionId = selectedSubscriptions[merchantId];
    if (!subscriptionId) { toast.error('Please select a subscription'); return; }
    try {
      setSavingSub(merchantId);
      const response = await fetch('/api/mercury/merchants/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantMappingId: merchantId, subscriptionId, organizationId }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save mapping');
      }
      const data = await response.json();
      toast.success(`Merchant mapped to subscription. ${data.backfill_count ?? 0} transactions backfilled.`);
      setMerchants((prev) => prev.filter((m) => m.id !== merchantId));
      setSelectedSubscriptions((prev) => { const u = { ...prev }; delete u[merchantId]; return u; });
      setAllLoaded(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to save mapping');
    } finally {
      setSavingSub(null);
    }
  };

  /** Persists a manual merchant -> contractor mapping. */
  const handleSaveMapping = async (merchantId: string) => {
    const contractorId = selectedMappings[merchantId];
    if (!contractorId) {
      toast.error('Please select a contractor');
      return;
    }
    try {
      setSaving(merchantId);
      const response = await fetch('/api/mercury/merchants/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantMappingId: merchantId, contractorId, organizationId }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save mapping');
      }
      toast.success('Merchant mapped successfully');
      setMerchants((prev) => prev.filter((m) => m.id !== merchantId));
      setSelectedMappings((prev) => {
        const updated = { ...prev };
        delete updated[merchantId];
        return updated;
      });
      // Invalidate all-mappings cache so it reloads next time.
      setAllLoaded(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to save mapping');
    } finally {
      setSaving(null);
    }
  };

  /** Removes a merchant mapping and refreshes unmapped list. */
  const handleUnmap = async (mappingId: string, merchantName: string) => {
    if (!confirm(`Remove mapping for "${merchantName}"? It will be re-evaluated on next sync.`)) {
      return;
    }
    try {
      setUnmapping(mappingId);
      const response = await fetch(
        `/api/mercury/merchants/unmap?id=${mappingId}&organizationId=${organizationId}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to unmap merchant');
      }
      toast.success(`"${merchantName}" mapping removed`);
      setAllMappings((prev) => prev.filter((m) => m.id !== mappingId));
      // Reload unmapped list so the entry appears there.
      loadMerchants();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to unmap merchant');
    } finally {
      setUnmapping(null);
    }
  };

  /** Returns a human-readable label for a confidence value. */
  const confidenceLabel = (confidence: string) => {
    switch (confidence) {
      case 'EXACT':
        return 'Exact';
      case 'FUZZY':
        return 'Fuzzy';
      case 'MANUAL':
        return 'Manual';
      default:
        return confidence;
    }
  };

  /** Lazily load all-mappings when the user switches to the "all" tab. */
  const handleTabChange = (value: string) => {
    if (value === 'all' && organizationId && !allLoaded) {
      loadAllMappings();
    }
  };

  // ----------------------------------------------------------------
  // Early guard
  // ----------------------------------------------------------------

  if (!organizationId) {
    return <p className="text-red-600">Missing organization ID</p>;
  }

  // ----------------------------------------------------------------
  // Spinner helper
  // ----------------------------------------------------------------

  const Spinner = ({ text }: { text: string }) => (
    <div className="flex items-center gap-3 text-gray-600">
      <svg
        className="animate-spin h-5 w-5"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span>{text}</span>
    </div>
  );

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  return (
    <div>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <Tabs defaultValue="unmapped" onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="unmapped">
            Unmapped
            {merchants.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                {merchants.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">All Mappings</TabsTrigger>
        </TabsList>

        {/* ---- Unmapped tab ---- */}
        <TabsContent value="unmapped">
          {loading ? (
            <Spinner text="Loading merchants..." />
          ) : merchants.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <svg
                className="mx-auto h-12 w-12 text-green-500 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-lg font-medium text-gray-900 mb-1">All caught up!</p>
              <p className="text-gray-600">No unmapped merchants at this time.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Merchant Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Seen
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Map to Contractor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Map to Subscription
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {merchants.map((merchant) => (
                    <tr key={merchant.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {merchant.mercury_merchant_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(merchant.mapped_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={selectedMappings[merchant.id] || ''}
                          onChange={(e) => handleSelectContractor(merchant.id, e.target.value)}
                          disabled={!!selectedSubscriptions[merchant.id]}
                          className={`block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 ${selectedSubscriptions[merchant.id] ? 'bg-gray-100 text-gray-400' : ''}`}
                        >
                          <option value="">-- Select Contractor --</option>
                          {contractors.map((contractor) => (
                            <option key={contractor.id} value={contractor.id}>
                              {contractor.name}
                            </option>
                          ))}
                        </select>
                        <AddContractorModal
                          defaultName={merchant.mercury_merchant_name}
                          onCreated={(c) => handleContractorCreated(merchant.id, c)}
                          trigger={<button type="button" className="mt-1 text-xs text-blue-600 hover:text-blue-800 hover:underline">+ New Contractor</button>}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={selectedSubscriptions[merchant.id] || ''}
                          onChange={(e) => handleSelectSubscription(merchant.id, e.target.value)}
                          disabled={!!selectedMappings[merchant.id]}
                          className={`block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-purple-500 focus:border-purple-500 ${selectedMappings[merchant.id] ? 'bg-gray-100 text-gray-400' : ''}`}
                        >
                          <option value="">-- Select Subscription --</option>
                          {subscriptions.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <AddSubscriptionModal
                          defaultName={merchant.mercury_merchant_name}
                          onCreated={(s) => handleSubscriptionCreated(merchant.id, s)}
                          trigger={<button type="button" className="mt-1 text-xs text-purple-600 hover:text-purple-800 hover:underline">+ New Subscription</button>}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {(() => {
                          const hasContractor = !!selectedMappings[merchant.id];
                          const hasSub = !!selectedSubscriptions[merchant.id];
                          const isSaving = saving === merchant.id || savingSub === merchant.id;
                          return (
                            <button
                              onClick={() => hasContractor ? handleSaveMapping(merchant.id) : handleSaveSubscriptionMapping(merchant.id)}
                              disabled={(!hasContractor && !hasSub) || isSaving}
                              className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white disabled:opacity-50 disabled:cursor-not-allowed ${hasSub ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                              {isSaving ? 'Saving...' : hasContractor ? 'Map Contractor' : hasSub ? 'Map Subscription' : 'Map'}
                            </button>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ---- All Mappings tab ---- */}
        <TabsContent value="all">
          {allLoading ? (
            <Spinner text="Loading all mappings..." />
          ) : allMappings.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">No merchant mappings found.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Merchant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mapped To
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Confidence
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mapped At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {allMappings.map((mapping) => {
                    const mappedName = mapping.contractor_name ?? mapping.agency_name ?? mapping.subscription_name;
                    const mappedType = mapping.contractor_name
                      ? 'Contractor'
                      : mapping.agency_name
                      ? 'Agency'
                      : mapping.subscription_name
                      ? 'Subscription'
                      : '\u2014';
                    return (
                      <tr key={mapping.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {mapping.mercury_merchant_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {mapping.subscription_id && mapping.subscription_name ? (
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
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${mappedType === 'Subscription' ? 'bg-purple-100 text-purple-700' : mappedType === 'Contractor' ? 'bg-blue-100 text-blue-700' : mappedType === 'Agency' ? 'bg-green-100 text-green-700' : 'text-gray-500'}`}>
                            {mappedType}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              mapping.mapping_confidence === 'MANUAL'
                                ? 'bg-blue-100 text-blue-700'
                                : mapping.mapping_confidence === 'EXACT'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {confidenceLabel(mapping.mapping_confidence)}
                            {mapping.confidence_score != null && (
                              <span className="ml-1 opacity-75">
                                {(Number(mapping.confidence_score) * 100).toFixed(0)}%
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(mapping.mapped_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleUnmap(mapping.id, mapping.mercury_merchant_name)}
                            disabled={unmapping === mapping.id}
                            className="inline-flex items-center px-3 py-1.5 border border-red-300 text-xs font-medium rounded text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {unmapping === mapping.id ? 'Removing...' : 'Unmap'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
