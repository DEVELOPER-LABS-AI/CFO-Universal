import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getErrorMessage } from '@/lib/utils/error'

export async function GET() {
  const checks: Record<string, string> = {}

  // Test DB connection
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = 'ok'
  } catch (e: unknown) {
    checks.database = `error: ${getErrorMessage(e)}`
  }

  // Test user_profiles table
  try {
    const count = await prisma.userProfile.count()
    checks.user_profiles = `ok (${count} rows)`
  } catch (e: unknown) {
    checks.user_profiles = `error: ${getErrorMessage(e)}`
  }

  // Test Feature 1 models exist on Prisma client
  try {
    const count = await prisma.subscriptionTransactionRecord.count()
    checks.subscription_transaction_records = `ok (${count} rows)`
  } catch (e: unknown) {
    checks.subscription_transaction_records = `error: ${getErrorMessage(e)}`
  }

  const allOk = Object.values(checks).every((v) => v.startsWith('ok'))
  return NextResponse.json({ status: allOk ? 'ok' : 'degraded', checks })
}
