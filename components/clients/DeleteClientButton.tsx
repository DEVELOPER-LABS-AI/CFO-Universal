'use client';

import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal';
import { softDeleteClient } from '@/app/actions/client-management';

interface DeleteClientButtonProps {
  clientId: string;
  clientName: string;
}

export function DeleteClientButton({ clientId, clientName }: DeleteClientButtonProps) {
  const router = useRouter();

  return (
    <DeleteConfirmModal
      entityName="client"
      displayName={clientName}
      onConfirm={async () => {
        await softDeleteClient(clientId);
        router.push('/dashboard/clients');
      }}
      trigger={
        <Button variant="destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Client
        </Button>
      }
    />
  );
}
