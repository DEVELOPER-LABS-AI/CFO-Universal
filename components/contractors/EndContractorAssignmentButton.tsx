'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { endContractorAssignment } from '@/app/actions/contractor-management';
import { UserMinus } from 'lucide-react';
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal';

interface EndContractorAssignmentButtonProps {
  assignmentId: string;
  contractorName: string;
  clientName: string;
}

/**
 * Button to end (unassign) a contractor assignment by setting end_date to now.
 * Uses async Dialog instead of blocking confirm() to avoid INP issues.
 */
export function EndContractorAssignmentButton({
  assignmentId,
  contractorName,
  clientName,
}: EndContractorAssignmentButtonProps) {
  const router = useRouter();

  return (
    <DeleteConfirmModal
      entityName="assignment"
      displayName={`${contractorName} from ${clientName}`}
      onConfirm={async () => {
        await endContractorAssignment(assignmentId);
        router.refresh();
      }}
      trigger={
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          title="End assignment"
        >
          <UserMinus className="h-4 w-4" />
        </Button>
      }
    />
  );
}
