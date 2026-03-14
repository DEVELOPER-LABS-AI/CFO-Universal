'use client';

import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal';
import { softDeleteStaff } from '@/app/actions/staff-management';

interface DeleteStaffButtonProps {
  staffId: string;
  staffName: string;
}

export function DeleteStaffButton({ staffId, staffName }: DeleteStaffButtonProps) {
  const router = useRouter();

  return (
    <DeleteConfirmModal
      entityName="staff member"
      displayName={staffName}
      onConfirm={async () => {
        await softDeleteStaff(staffId);
        router.push('/dashboard/staff');
      }}
      trigger={
        <Button variant="destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      }
    />
  );
}
