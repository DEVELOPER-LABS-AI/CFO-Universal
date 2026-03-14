import { Badge } from '@/components/ui/badge';
import { ClientStatus } from '@prisma/client';

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const variants = {
    ACTIVE: 'default' as const,
    INACTIVE: 'secondary' as const,
    CHURNED: 'destructive' as const,
  };

  return <Badge variant={variants[status]}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}
