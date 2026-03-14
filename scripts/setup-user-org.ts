import { prisma } from '../lib/prisma';

async function setupUserOrganization() {
  const userId = '228c1944-7de7-4a2e-a27a-010dd14b89e4';

  console.log('🔍 Checking for existing organization...');

  // Check if organization exists
  let organization = await prisma.organization.findFirst({
    where: { name: 'DeveloperLabs' },
  });

  if (!organization) {
    console.log('📝 Creating organization: DeveloperLabs');
    organization = await prisma.organization.create({
      data: {
        name: 'DeveloperLabs',
      },
    });
    console.log('✅ Organization created:', organization.id);
  } else {
    console.log('✅ Organization already exists:', organization.id);
  }

  console.log('\n🔍 Checking user-organization association...');

  // Check if user is already associated
  const existing = await prisma.userOrganization.findUnique({
    where: {
      user_id_organization_id: {
        user_id: userId,
        organization_id: organization.id,
      },
    },
  });

  if (!existing) {
    console.log('📝 Creating user-organization association...');
    const userOrg = await prisma.userOrganization.create({
      data: {
        user_id: userId,
        organization_id: organization.id,
        role: 'owner',
      },
    });
    console.log('✅ Association created:', userOrg.id);
  } else {
    console.log('✅ Association already exists');
  }

  // Verify setup
  console.log('\n🔍 Verifying setup...');
  const verification = await prisma.userOrganization.findFirst({
    where: { user_id: userId },
    include: {
      organization: true,
    },
  });

  if (verification) {
    console.log('\n✅ Setup complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('User ID:         ', userId);
    console.log('Organization ID: ', verification.organization_id);
    console.log('Organization:    ', verification.organization.name);
    console.log('Role:            ', verification.role);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } else {
    console.log('❌ Verification failed');
  }
}

setupUserOrganization()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
