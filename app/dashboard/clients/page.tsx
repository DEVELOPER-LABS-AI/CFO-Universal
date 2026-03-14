import { getClients } from '@/app/actions/client-management';
import { getServices } from '@/app/actions/service-management';
import { ClientsPageContent } from '@/components/clients/ClientsPageContent';
import { AddClientModal } from '@/components/clients/AddClientModal';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default async function ClientsPage() {
  const [{ clients, monthlyRevenue }, services] = await Promise.all([
    getClients(),
    getServices({ is_active: 'true' }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clients</h1>
          <p className="text-muted-foreground">Manage your client portfolio</p>
        </div>
        <AddClientModal
          services={services}
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          }
        />
      </div>

      <ClientsPageContent clients={clients} monthlyRevenue={monthlyRevenue} />
    </div>
  );
}
