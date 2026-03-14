import { getServices } from '@/app/actions/service-management';
import { AddServiceModal } from '@/components/services/AddServiceModal';
import { ServiceTableRow } from '@/components/services/ServiceTableRow';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default async function ServicesPage() {
  const services = await getServices();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Services</h1>
        <AddServiceModal
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Service
            </Button>
          }
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead>Target Margin</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((service) => (
            <ServiceTableRow key={service.id} service={service} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
