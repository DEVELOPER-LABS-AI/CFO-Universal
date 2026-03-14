/**
 * Manual Contact Mapping Page
 *
 * Allows admins to manually map unmapped Xero contacts to internal clients.
 * Displays contacts from failed invoice syncs with MAPPING_FAILED errors.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface UnmappedContact {
  xero_contact_id: string;
  xero_contact_name: string;
  xero_contact_email?: string;
  invoice_count: number;
}

interface Client {
  id: string;
  name: string;
}

export default function ManualMappingsPage() {
  const [contacts, setContacts] = useState<UnmappedContact[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMappings, setSelectedMappings] = useState<Record<string, string>>({});
  const [savingMapping, setSavingMapping] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch unmapped contacts and clients in parallel
      const [contactsRes, clientsRes] = await Promise.all([
        fetch('/api/xero/mappings/unmapped/details'),
        fetch('/api/clients'),
      ]);

      if (!contactsRes.ok || !clientsRes.ok) {
        throw new Error('Failed to load data');
      }

      const [contactsData, clientsData] = await Promise.all([
        contactsRes.json(),
        clientsRes.json(),
      ]);

      setContacts(contactsData.contacts || []);
      setClients(clientsData.clients || []);
    } catch (err) {
      console.error('Failed to load mappings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleMapContact = async (contactId: string, contactName: string) => {
    const clientId = selectedMappings[contactId];

    if (!clientId) {
      alert('Please select a client first');
      return;
    }

    setSavingMapping(contactId);

    try {
      const response = await fetch('/api/xero/mappings/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      // Remove the mapped contact from the list
      setContacts((prev) => prev.filter((c) => c.xero_contact_id !== contactId));

      // Clear selection
      setSelectedMappings((prev) => {
        const newMappings = { ...prev };
        delete newMappings[contactId];
        return newMappings;
      });
    } catch (err) {
      console.error('Failed to save mapping:', err);
      alert(err instanceof Error ? err.message : 'Failed to save mapping');
    } finally {
      setSavingMapping(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-lg font-semibold text-red-900">Error</h3>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manual Contact Mappings</h1>
          <p className="mt-1 text-sm text-gray-600">
            Map unmapped Xero contacts to internal clients
          </p>
        </div>
        <Link
          href="/dashboard/integrations/xero"
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          &larr; Back to Integration
        </Link>
      </div>

      {contacts.length === 0 ? (
        <div className="p-8 bg-green-50 border border-green-200 rounded-lg text-center">
          <h3 className="text-lg font-semibold text-green-900">All Contacts Mapped!</h3>
          <p className="mt-1 text-sm text-green-700">
            There are no unmapped contacts at this time.
          </p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Xero Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoices
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Map to Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contacts.map((contact) => (
                <tr key={contact.xero_contact_id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {contact.xero_contact_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      ID: {contact.xero_contact_id.substring(0, 8)}...
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {contact.xero_contact_email || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      {contact.invoice_count} invoice{contact.invoice_count !== 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() =>
                        handleMapContact(
                          contact.xero_contact_id,
                          contact.xero_contact_name
                        )
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
    </div>
  );
}
