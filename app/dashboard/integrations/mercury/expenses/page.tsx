/**
 * Mercury Expenses Page (Server Wrapper)
 *
 * Fetches organizationId from authenticated session and passes to the client component.
 */

import { getOrganizationId } from '@/lib/auth/organization';
import { MercuryExpensesContent } from '@/components/mercury/MercuryExpensesContent';

export default async function MercuryExpensesPage() {
  const organizationId = await getOrganizationId();
  return <MercuryExpensesContent organizationId={organizationId} />;
}
