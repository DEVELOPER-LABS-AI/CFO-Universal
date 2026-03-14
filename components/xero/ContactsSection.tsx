/**
 * ContactsSection Component
 *
 * Displays Xero contact mappings in a tabbed interface:
 * - "Unmapped" tab: shows unmapped contacts with client dropdown and Map button
 * - "All Mappings" tab: shows all existing contact-to-client mappings
 *
 * Fetches data from /api/xero/mappings/unmapped/details and /api/xero/mappings/all.
 * Posts to /api/xero/mappings/manual to save new mappings.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

/** Shape of an unmapped Xero contact from the details API. */
interface UnmappedContact {
  xero_contact_id: string;
  xero_contact_name: string;
  xero_contact_email?: string;
  invoice_count: number;
}

/** Shape of an existing contact mapping from the all-mappings API. */
interface ContactMapping {
  id: string;
  xero_contact_id: string;
  xero_contact_name: string;
  mapping_type: string;
  confidence_score: number | null;
  created_at: string;
  client: {
    id: string;
    name: string;
    status: string;
  };
}

/** Minimal client record used in the mapping dropdown. */
interface Client {
  id: string;
  name: string;
}

export function ContactsSection() {
  // Unmapped tab state
  const [unmappedContacts, setUnmappedContacts] = useState<UnmappedContact[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [unmappedLoading, setUnmappedLoading] = useState(true);
  const [unmappedError, setUnmappedError] = useState<string | null>(null);
  const [selectedMappings, setSelectedMappings] = useState<Record<string, string>>({});
  const [savingMapping, setSavingMapping] = useState<string | null>(null);

  // All mappings tab state
  const [allMappings, setAllMappings] = useState<ContactMapping[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [allError, setAllError] = useState<string | null>(null);
  const [allLoaded, setAllLoaded] = useState(false);

  /**
   * Load unmapped contacts and the client list in parallel.
   * Called on mount to populate the unmapped tab.
   */
  const loadUnmapped = useCallback(async () => {
    try {
      setUnmappedLoading(true);
      setUnmappedError(null);

      const [contactsRes, clientsRes] = await Promise.all([
        fetch('/api/xero/mappings/unmapped/details'),
        fetch('/api/clients'),
      ]);

      if (!contactsRes.ok || !clientsRes.ok) {
        throw new Error('Failed to load unmapped contacts data');
      }

      const [contactsData, clientsData] = await Promise.all([
        contactsRes.json(),
        clientsRes.json(),
      ]);

      setUnmappedContacts(contactsData.contacts || []);
      setClients(clientsData.clients || []);
    } catch (err) {
      console.error('Failed to load unmapped contacts:', err);
      setUnmappedError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setUnmappedLoading(false);
    }
  }, []);

  /**
   * Load all existing contact mappings.
   * Called lazily when the "All Mappings" tab is selected for the first time.
   */
  const loadAllMappings = useCallback(async () => {
    if (allLoaded) return;
    try {
      setAllLoading(true);
      setAllError(null);

      const res = await fetch('/api/xero/mappings/all');
      if (!res.ok) {
        throw new Error('Failed to load contact mappings');
      }

      const data = await res.json();
      setAllMappings(data.mappings || []);
      setAllLoaded(true);
    } catch (err) {
      console.error('Failed to load all mappings:', err);
      setAllError(err instanceof Error ? err.message : 'Failed to load mappings');
    } finally {
      setAllLoading(false);
    }
  }, [allLoaded]);

  useEffect(() => {
    loadUnmapped();
  }, [loadUnmapped]);

  /**
   * Save a manual mapping for the given contact. Posts to the manual mapping
   * endpoint and removes the contact from the unmapped list on success.
   */
  const handleMapContact = async (contactId: string, contactName: string) => {
    const clientId = selectedMappings[contactId];
    if (!clientId) return;

    setSavingMapping(contactId);
    try {
      const response = await fetch('/api/xero/mappings/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xero_contact_id: contactId,
          xero_contact_name: contactName,
          client_id: clientId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save mapping');
      }

      // Remove the mapped contact from the unmapped list
      setUnmappedContacts((prev) => prev.filter((c) => c.xero_contact_id !== contactId));
      setSelectedMappings((prev) => {
        const next = { ...prev };
        delete next[contactId];
        return next;
      });

      // Invalidate all-mappings cache so it reloads on next tab switch
      setAllLoaded(false);
    } catch (err) {
      console.error('Failed to save mapping:', err);
      alert(err instanceof Error ? err.message : 'Failed to save mapping');
    } finally {
      setSavingMapping(null);
    }
  };

  /**
   * Handle tab changes -- lazy-load the all-mappings data when the tab is first activated.
   */
  const handleTabChange = (value: string) => {
    if (value === 'all') {
      loadAllMappings();
    }
  };

  /** Returns a human-readable label for a mapping type enum value. */
  const mappingTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      EMAIL_EXACT: 'Email Match',
      NAME_EXACT: 'Name Match',
      NAME_FUZZY: 'Fuzzy Match',
      MANUAL: 'Manual',
    };
    return labels[type] || type;
  };

  return (
    <Tabs defaultValue="unmapped" onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="unmapped">
          Unmapped
          {!unmappedLoading && unmappedContacts.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
              {unmappedContacts.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="all">All Mappings</TabsTrigger>
      </TabsList>

      {/* Unmapped contacts tab */}
      <TabsContent value="unmapped">
        {unmappedLoading ? (
          <div className="animate-pulse space-y-3 py-4">
            <div className="h-4 bg-gray-200 rounded w-48" />
            <div className="h-24 bg-gray-200 rounded" />
          </div>
        ) : unmappedError ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{unmappedError}</p>
          </div>
        ) : unmappedContacts.length === 0 ? (
          <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center">
            <p className="text-sm font-medium text-green-900">All contacts mapped</p>
            <p className="mt-1 text-xs text-green-700">
              There are no unmapped Xero contacts at this time.
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Xero Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoices
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Map to Client
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {unmappedContacts.map((contact) => (
                  <tr key={contact.xero_contact_id}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {contact.xero_contact_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {contact.xero_contact_id.substring(0, 8)}...
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {contact.xero_contact_email || '--'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {contact.invoice_count} invoice{contact.invoice_count !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <select
                        value={selectedMappings[contact.xero_contact_id] || ''}
                        onChange={(e) =>
                          setSelectedMappings((prev) => ({
                            ...prev,
                            [contact.xero_contact_id]: e.target.value,
                          }))
                        }
                        className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        disabled={savingMapping === contact.xero_contact_id}
                      >
                        <option value="">Select client...</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() =>
                          handleMapContact(contact.xero_contact_id, contact.xero_contact_name)
                        }
                        disabled={
                          !selectedMappings[contact.xero_contact_id] ||
                          savingMapping === contact.xero_contact_id
                        }
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        {savingMapping === contact.xero_contact_id ? 'Saving...' : 'Map'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>

      {/* All mappings tab */}
      <TabsContent value="all">
        {allLoading ? (
          <div className="animate-pulse space-y-3 py-4">
            <div className="h-4 bg-gray-200 rounded w-48" />
            <div className="h-24 bg-gray-200 rounded" />
          </div>
        ) : allError ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{allError}</p>
          </div>
        ) : allMappings.length === 0 ? (
          <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
            <p className="text-sm font-medium text-gray-700">No mappings yet</p>
            <p className="mt-1 text-xs text-gray-500">
              Contact mappings will appear here after syncing with Xero.
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Xero Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mapping Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Confidence
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mapped At
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {allMappings.map((mapping) => (
                  <tr key={mapping.id}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {mapping.xero_contact_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {mapping.xero_contact_id.substring(0, 8)}...
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{mapping.client.name}</div>
                      <div className="text-xs text-gray-500 capitalize">
                        {mapping.client.status.toLowerCase()}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded">
                        {mappingTypeLabel(mapping.mapping_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {mapping.confidence_score !== null
                        ? `${Math.round(mapping.confidence_score * 100)}%`
                        : '--'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {new Date(mapping.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
