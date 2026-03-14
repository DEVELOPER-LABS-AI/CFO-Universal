'use client';

import { useState, useMemo } from 'react';
import { ClientTable } from './ClientTable';
import type { ClientWithServices } from '@/types/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';

interface ClientsPageContentProps {
  clients: ClientWithServices[];
  monthlyRevenue: number;
}

export function ClientsPageContent({ clients, monthlyRevenue }: ClientsPageContentProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      // Search filter
      const matchesSearch = searchQuery === '' ||
        client.name.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === 'all' || client.status === statusFilter;

      // Type filter
      const matchesType = typeFilter === 'all' || client.relationship_type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [clients, searchQuery, statusFilter, typeFilter]);

  const activeCount = clients.filter((c) => c.status === 'ACTIVE').length;
  const totalRevenue = clients.reduce((sum, c) => sum + (c.total_revenue ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium text-muted-foreground">Total Clients</p>
          <p className="text-2xl font-bold">{clients.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium text-muted-foreground">Active</p>
          <p className="text-2xl font-bold">{activeCount}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium text-muted-foreground">Monthly Revenue</p>
          <p className="text-2xl font-bold">{formatCurrency(monthlyRevenue)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium text-muted-foreground">Total Revenue Collected</p>
          <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
            <SelectItem value="CHURNED">Churned</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="RETAINER">Retainer</SelectItem>
            <SelectItem value="PROJECT_BASED">Project Based</SelectItem>
            <SelectItem value="HOURLY">Hourly</SelectItem>
            <SelectItem value="VALUE_BASED">Value Based</SelectItem>
            <SelectItem value="CUSTOM">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results Count */}
      {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all') && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredClients.length} of {clients.length} clients
        </p>
      )}

      {/* Client Table */}
      <ClientTable clients={filteredClients} />
    </div>
  );
}
