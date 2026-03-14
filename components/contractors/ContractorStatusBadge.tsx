import { Badge } from '@/components/ui/badge';
import { ContractorStatus } from '@prisma/client';

/**
 * Renders a colored badge for the contractor's ACTIVE/INACTIVE status.
 */
export function ContractorStatusBadge({ status }: { status: ContractorStatus }) {
  const variants = {
    ACTIVE: 'default' as const,
    INACTIVE: 'secondary' as const,
  };

  return <Badge variant={variants[status]}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}
