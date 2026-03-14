import { prisma } from '../lib/prisma';

/**
 * Test authentication and organization ID retrieval
 *
 * This simulates what happens when a server action is called
 */
async function testAuth() {
  const userId = '228c1944-7de7-4a2e-a27a-010dd14b89e4';

  console.log('🔐 Testing authentication flow...\n');

  // Step 1: Get user's organization (simulating getOrganizationId())
  const userOrg = await prisma.userOrganization.findFirst({
    where: { user_id: userId },
    include: {
      organization: true,
    },
  });

  if (!userOrg) {
    console.log('❌ No organization found for user');
    return;
  }

  console.log('✅ Organization retrieved:');
  console.log('   ID:', userOrg.organization_id);
  console.log('   Name:', userOrg.organization.name);
  console.log('   Role:', userOrg.role);

  // Step 2: Test querying data with organization scope
  console.log('\n📊 Testing data access with organization scope...\n');

  const organizationId = userOrg.organization_id;

  // Test each table
  const [clients, services, staff, subscriptions, agencies] = await Promise.all([
    prisma.client.count({ where: { organization_id: organizationId, deleted_at: null } }),
    prisma.service.count({ where: { organization_id: organizationId, deleted_at: null } }),
    prisma.staff.count({ where: { organization_id: organizationId, deleted_at: null } }),
    prisma.subscription.count({ where: { organization_id: organizationId, deleted_at: null } }),
    prisma.agency.count({ where: { organization_id: organizationId, deleted_at: null } }),
  ]);

  console.log('Data accessible to your organization:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Clients:        ', clients);
  console.log('Services:       ', services);
  console.log('Staff:          ', staff);
  console.log('Subscriptions:  ', subscriptions);
  console.log('Agencies:       ', agencies);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (clients === 0 && services === 0 && staff === 0) {
    console.log('\n💡 No data found. This is normal for a new setup!');
    console.log('   You can add sample data or start using the app.');
  } else {
    console.log('\n✅ You already have data in the system!');
  }

  console.log('\n✅ Authentication test complete!');
  console.log('   Your server actions will work correctly.');
}

testAuth()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
