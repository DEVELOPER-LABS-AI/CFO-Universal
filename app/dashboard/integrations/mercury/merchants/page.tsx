/**
 * Manual Merchant Mapping Page (Server Wrapper)
 *
 * Fetches organizationId from authenticated session and passes to the client component.
 */

import { getOrganizationId } from '@/lib/auth/organization';
import { MerchantMappingContent } from '@/components/mercury/MerchantMappingContent';

export default async function MerchantMappingPage() {
  const organizationId = await getOrganizationId();
  return <MerchantMappingContent organizationId={organizationId} />;
}
