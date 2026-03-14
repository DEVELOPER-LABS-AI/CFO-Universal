'use client';

import { useRouter } from 'next/navigation';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { EditServiceModal } from './EditServiceModal';
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal';
import { softDeleteService } from '@/app/actions/service-management';
import { Service } from '@prisma/client';

export function ServiceTableRow({ service }: { service: Service }) {
  const router = useRouter();

  return (
    <TableRow>
      <TableCell className="font-medium">{service.name}</TableCell>
      <TableCell>
        ${Number(service.standard_rate).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        <span className="text-xs text-muted-foreground ml-1">
          {service.billing_type === 'one_time' ? '(one-time)' : '/hr'}
        </span>
      </TableCell>
      <TableCell>{Number(service.target_margin).toFixed(1)}%</TableCell>
      <TableCell>
        <Badge variant={service.is_active ? 'default' : 'secondary'}>
          {service.is_active ? 'Active' : 'Deprecated'}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <EditServiceModal
            service={service}
            trigger={
              <Button variant="ghost" size="sm">
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
          <DeleteConfirmModal
            entityName="service"
            displayName={service.name}
            onConfirm={async () => {
              await softDeleteService(service.id);
              router.refresh();
            }}
            trigger={
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            }
          />
        </div>
      </TableCell>
    </TableRow>
  );
}
