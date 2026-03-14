'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import { EditContractorModal } from './EditContractorModal';
import { AssignContractorToClientModal } from './AssignContractorToClientModal';
import { ContractorStatusBadge } from './ContractorStatusBadge';
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal';
import { softDeleteContractor, toggleContractorStatus } from '@/app/actions/contractor-management';
import type { ContractorWithUtilization } from '@/types/contractor';

interface ContractorTableRowProps {
  contractor: ContractorWithUtilization;
  clients: Array<{ id: string; name: string }>;
}

export function ContractorTableRow({ contractor, clients }: ContractorTableRowProps) {
  const router = useRouter();

  const isInactive = contractor.status === 'INACTIVE';

  return (
    <TableRow className={isInactive ? 'opacity-60' : undefined}>
      <TableCell className="font-medium">
        <Link href={`/dashboard/contractors/${contractor.id}`} className="hover:underline">
          {contractor.name}
        </Link>
      </TableCell>
      <TableCell>
        <button
          onClick={async () => {
            await toggleContractorStatus(contractor.id);
            router.refresh();
          }}
          title={`Click to mark as ${isInactive ? 'Active' : 'Inactive'}`}
          className="cursor-pointer"
        >
          <ContractorStatusBadge status={contractor.status} />
        </button>
      </TableCell>
      <TableCell>{contractor.rate != null && contractor.rate_type ? `$${Number(contractor.rate).toFixed(2)}/${contractor.rate_type.toLowerCase()}` : '--'}</TableCell>
      <TableCell className="capitalize">{contractor.engagement_type ? contractor.engagement_type.replace(/_/g, ' ').toLowerCase() : '--'}</TableCell>
      <TableCell>
        <Badge variant={contractor.utilization > 100 ? 'destructive' : 'default'}>
          {contractor.utilization}%
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {!isInactive && (
            <AssignContractorToClientModal
              contractorId={contractor.id}
              contractorName={contractor.name}
              currentUtilization={contractor.utilization}
              clients={clients}
              trigger={
                <Button variant="ghost" size="sm" title="Assign to client">
                  <UserPlus className="h-4 w-4" />
                </Button>
              }
            />
          )}
          <EditContractorModal
            contractor={contractor}
            trigger={
              <Button variant="ghost" size="sm">
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
          <DeleteConfirmModal
            entityName="contractor"
            displayName={contractor.name}
            onConfirm={async () => {
              await softDeleteContractor(contractor.id);
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
