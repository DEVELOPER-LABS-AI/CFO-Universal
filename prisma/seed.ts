import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['error', 'warn'],
})

async function main() {
  console.log('🌱 Seeding database...')

  // ============================================================================
  // Create Test Organization
  // ============================================================================
  console.log('\n📊 Creating organization...')

  const org = await prisma.organization.upsert({
    where: { name: 'DevLabs Test Agency' },
    update: {},
    create: {
      name: 'DevLabs Test Agency',
      subscription_tier: 'pro',
    },
  })
  console.log(`✅ Organization created: ${org.name} (${org.id})`)

  // ============================================================================
  // Create Test Services
  // ============================================================================
  console.log('\n🛠️  Creating services...')

  const webDevService = await prisma.service.upsert({
    where: { id: 'seed-service-web-dev' },
    update: {},
    create: {
      id: 'seed-service-web-dev',
      organization_id: org.id,
      name: 'Web Development',
      description: 'Full-stack web development services',
      standard_rate: 150.00,
      target_margin: 40.00,
    },
  })
  console.log(`✅ Service created: ${webDevService.name}`)

  const seoService = await prisma.service.upsert({
    where: { id: 'seed-service-seo' },
    update: {},
    create: {
      id: 'seed-service-seo',
      organization_id: org.id,
      name: 'SEO Services',
      description: 'Search engine optimization and content strategy',
      standard_rate: 120.00,
      target_margin: 45.00,
    },
  })
  console.log(`✅ Service created: ${seoService.name}`)

  // ============================================================================
  // Create Test Clients
  // ============================================================================
  console.log('\n👥 Creating clients...')

  const acmeClient = await prisma.client.upsert({
    where: { id: 'seed-client-acme' },
    update: {},
    create: {
      id: 'seed-client-acme',
      organization_id: org.id,
      name: 'Acme Corporation',
      status: 'ACTIVE',
      relationship_type: 'RETAINER',
      custom_margin_target: 45.00,
      start_date: new Date('2025-01-01'),
    },
  })
  console.log(`✅ Client created: ${acmeClient.name}`)

  const globexClient = await prisma.client.upsert({
    where: { id: 'seed-client-globex' },
    update: {},
    create: {
      id: 'seed-client-globex',
      organization_id: org.id,
      name: 'Globex Industries',
      status: 'ACTIVE',
      relationship_type: 'PROJECT_BASED',
      start_date: new Date('2025-02-01'),
    },
  })
  console.log(`✅ Client created: ${globexClient.name}`)

  const initechClient = await prisma.client.upsert({
    where: { id: 'seed-client-initech' },
    update: {},
    create: {
      id: 'seed-client-initech',
      organization_id: org.id,
      name: 'Initech Solutions',
      status: 'INACTIVE',
      relationship_type: 'HOURLY',
      start_date: new Date('2024-06-01'),
      churn_date: new Date('2024-12-31'),
    },
  })
  console.log(`✅ Client created: ${initechClient.name}`)

  // ============================================================================
  // Create Test Contractors
  // ============================================================================
  console.log('\n👨‍💻 Creating contractors...')

  const contractor1 = await prisma.contractor.create({
    data: {
      organization_id: org.id,
      name: 'John Developer',
      rate: 75.00,
      rate_type: 'HOURLY',
      engagement_type: 'FULL_TIME',
    },
  })
  console.log(`✅ Contractor created: ${contractor1.name}`)

  const contractor2 = await prisma.contractor.create({
    data: {
      organization_id: org.id,
      name: 'Jane Designer',
      rate: 65.00,
      rate_type: 'HOURLY',
      engagement_type: 'PART_TIME',
    },
  })
  console.log(`✅ Contractor created: ${contractor2.name}`)

  // ============================================================================
  // Create Contractor Assignments
  // ============================================================================
  console.log('\n🔗 Creating contractor assignments...')

  await prisma.contractorAssignment.create({
    data: {
      contractor_id: contractor1.id,
      client_id: acmeClient.id,
      start_date: new Date('2025-01-01'),
      allocation_percentage: 100,
    },
  })
  console.log(`✅ Assignment: ${contractor1.name} → ${acmeClient.name}`)

  await prisma.contractorAssignment.create({
    data: {
      contractor_id: contractor2.id,
      client_id: globexClient.id,
      start_date: new Date('2025-02-01'),
      allocation_percentage: 50,
    },
  })
  console.log(`✅ Assignment: ${contractor2.name} → ${globexClient.name}`)

  // ============================================================================
  // Create Revenue Records
  // ============================================================================
  console.log('\n💰 Creating revenue records...')

  await prisma.revenueRecord.create({
    data: {
      organization_id: org.id,
      client_id: acmeClient.id,
      service_id: webDevService.id,
      amount: 15000.00,
      transaction_date: new Date('2025-01-15'),
      status: 'RECEIVED',
      description: 'January retainer payment',
      sync_source: 'MANUAL',
    },
  })
  console.log('✅ Revenue record: Acme - $15,000')

  await prisma.revenueRecord.create({
    data: {
      organization_id: org.id,
      client_id: globexClient.id,
      service_id: seoService.id,
      amount: 8000.00,
      transaction_date: new Date('2025-02-15'),
      status: 'INVOICED',
      description: 'SEO project milestone 1',
      sync_source: 'MANUAL',
    },
  })
  console.log('✅ Revenue record: Globex - $8,000')

  // ============================================================================
  // Create Expense Records
  // ============================================================================
  console.log('\n💸 Creating expense records...')

  await prisma.expenseRecord.create({
    data: {
      organization_id: org.id,
      client_id: acmeClient.id,
      contractor_id: contractor1.id,
      amount: 6000.00,
      transaction_date: new Date('2025-01-31'),
      category: 'CONTRACTOR_COST',
      description: 'John - 80 hours @ $75/hr',
      sync_source: 'MANUAL',
    },
  })
  console.log('✅ Expense record: Contractor cost - $6,000')

  await prisma.expenseRecord.create({
    data: {
      organization_id: org.id,
      client_id: null, // General expense
      contractor_id: null,
      amount: 500.00,
      transaction_date: new Date('2025-01-31'),
      category: 'SUBSCRIPTION',
      description: 'Figma subscription',
      sync_source: 'MANUAL',
    },
  })
  console.log('✅ Expense record: Subscription - $500')

  // ============================================================================
  // Create Client Metrics
  // ============================================================================
  console.log('\n📈 Creating client metrics...')

  await prisma.clientMetrics.create({
    data: {
      client_id: acmeClient.id,
      period_start: new Date('2025-01-01'),
      period_end: new Date('2025-01-31'),
      total_revenue: 15000.00,
      total_costs: 6000.00,
      actual_margin: 60.00, // (15000 - 6000) / 15000 * 100
      target_margin: 45.00,
      tier_classification: 1, // Tier 1 - Scale Client (exceeding target)
    },
  })
  console.log('✅ Client metrics: Acme - 60% margin (Tier 1)')

  // ============================================================================
  // Create Company Metrics
  // ============================================================================
  console.log('\n🏢 Creating company metrics...')

  await prisma.companyMetrics.create({
    data: {
      organization_id: org.id,
      period_start: new Date('2025-01-01'),
      period_end: new Date('2025-01-31'),
      portfolio_margin: 56.52, // (15000 - 6500) / 15000 * 100
      total_revenue: 15000.00,
      total_expenses: 6500.00,
      client_count: 2, // Acme + Globex (active)
    },
  })
  console.log('✅ Company metrics: 56.52% portfolio margin')

  // ============================================================================
  // Create Financial Targets
  // ============================================================================
  console.log('\n🎯 Creating financial targets...')

  await prisma.financialTarget.create({
    data: {
      organization_id: org.id,
      scope: 'GLOBAL',
      scope_id: null,
      target_margin: 40.00,
      target_revenue: 100000.00,
      fiscal_period: 'Q1-2025',
    },
  })
  console.log('✅ Financial target: Q1-2025 - 40% margin, $100k revenue')

  // ============================================================================
  // Create Growth Scenario
  // ============================================================================
  console.log('\n🚀 Creating growth scenario...')

  await prisma.growthScenario.create({
    data: {
      organization_id: org.id,
      scenario_name: 'Hire 2 Contractors',
      assumptions: {
        new_contractors: 2,
        contractor_rate: 70,
        utilization: 80,
        months: 6,
      },
      projected_revenue: 180000.00,
      projected_margin: 42.00,
      created_by: 'seed-script',
    },
  })
  console.log('✅ Growth scenario: Hire 2 Contractors - $180k revenue, 42% margin')

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('\n✨ Seed data complete!')
  console.log('\n📊 Summary:')
  console.log('  - 1 Organization')
  console.log('  - 2 Services')
  console.log('  - 3 Clients (2 active, 1 inactive)')
  console.log('  - 2 Contractors')
  console.log('  - 2 Contractor Assignments')
  console.log('  - 2 Revenue Records')
  console.log('  - 2 Expense Records')
  console.log('  - 1 Client Metrics')
  console.log('  - 1 Company Metrics')
  console.log('  - 1 Financial Target')
  console.log('  - 1 Growth Scenario')
  console.log('\n🎉 Ready to test! Open Prisma Studio: npx prisma studio')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
