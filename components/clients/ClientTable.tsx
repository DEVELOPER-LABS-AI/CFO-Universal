'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { ClientStatusBadge } from './ClientStatusBadge';
import { formatDate } from '@/lib/utils/date';
import type { ClientWithServices } from '@/types/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Users } from 'lucide-react';
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal';
import { softDeleteClient } from '@/app/actions/client-management';
import { formatCurrency } from '@/lib/utils/currency';

export function ClientTable({ clients }: { clients: ClientWithServices[] }) {
  const router = useRouter();

  if (clients.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-12 w-12" />}
        title="No clients found"
        description="Try adjusting your search or filters, or add a new client to get started."
      />
    );
  }

  return (
    <div className="hidden sm:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Services</TableHead>
            <TableHead className="text-right">Total Revenue</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id}>
              <TableCell>
                <Link href={`/dashboard/clients/${client.id}`} className="hover:underline font-medium">
                  {client.name}
                </Link>
              </TableCell>
              <TableCell><ClientStatusBadge status={client.status} /></TableCell>
              <TableCell className="capitalize">
                {client.relationship_type.replace(/_/g, ' ').toLowerCase()}
              </TableCell>
              <TableCell>
                {client.client_services.slice(0, 2).map((cs) => (
                  <Badge key={cs.service.id} variant="outline" className="mr-1">
                    {cs.service.name}
                  </Badge>
                ))}
                {client.client_services.length > 2 && (
                  <Badge variant="secondary">+{client.client_services.length - 2}</Badge>
                )}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(client.total_revenue ?? 0)}
              </TableCell>
              <TableCell>{formatDate(client.start_date)}</TableCell>
              <TableCell className="text-right">
                <DeleteConfirmModal
                  entityName="client"
                  displayName={client.name}
                  onConfirm={async () => {
                    await softDeleteClient(client.id);
                    router.refresh();
                  }}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete client"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  }
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
