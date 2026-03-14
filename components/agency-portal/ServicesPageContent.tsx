'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { removeAgencyService } from '@/app/actions/agency-portal-actions';
import { AddServiceModal } from '@/components/agency-portal/AddServiceModal';
import { EditServiceModal } from '@/components/agency-portal/EditServiceModal';

/** Shape of a service item returned from the server action. */
interface Service {
  id: string;
  name: string;
  description: string | null;
  standard_rate: unknown;
  billing_type: string;
  target_margin: unknown;
  is_active: boolean;
}

interface ServicesPageContentProps {
  services: Service[];
}

/**
 * Client component that renders the services table with add/edit/remove actions.
 */
export function ServicesPageContent({ services }: ServicesPageContentProps) {
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);

  /**
   * Handle service removal with confirmation prompt.
   * Soft-deletes the service and refreshes the page data.
   */
  async function handleRemove(serviceId: string, serviceName: string) {
    const confirmed = window.confirm(
      `Are you sure you want to remove "${serviceName}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    setRemovingId(serviceId);
    try {
      await removeAgencyService(serviceId);
      toast.success(`Service "${serviceName}" removed successfully`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to remove service'
      );
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">All Services</h2>
        <AddServiceModal
          trigger={<Button size="sm">Add Service</Button>}
        />
      </div>

      {services.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-500">
          No services found. Add your first service to get started.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Margin Target</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow key={service.id}>
                <TableCell className="font-medium">{service.name}</TableCell>
                <TableCell className="text-gray-500">
                  {service.description || '-'}
                </TableCell>
                <TableCell className="text-right">
                  ${Number(service.standard_rate).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}
                  <span className="text-xs text-gray-400 ml-1">
                    {service.billing_type === 'one_time' ? '(one-time)' : '/hr'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {Number(service.target_margin)}%
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <EditServiceModal
                      trigger={
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      }
                      service={{
                        id: service.id,
                        name: service.name,
                        description: service.description,
                        standard_rate: service.standard_rate,
                        billing_type: service.billing_type,
                        target_margin: service.target_margin,
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleRemove(service.id, service.name)}
                      disabled={removingId === service.id}
                    >
                      {removingId === service.id ? 'Removing...' : 'Remove'}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
