/**
 * GET /api/mercury/merchants/all
 * Get all merchant mappings (mapped + unmapped) with contractor/agency names
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { getErrorMessage } from '@/lib/utils/error';

export async function GET(request: NextRequest) {
  try {
    await requireAdminOrExecutive();
    const organizationId = await getOrganizationId();

    const connection = await prisma.mercuryConnection.findUnique({
      where: { organization_id: organizationId },
      select: { id: true },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Mercury connection not found' },
        { status: 404 }
      );
    }

    const [rawMappings, contractors, agencies, subscriptions, allClients, expenseCategories, ownerStaff] = await Promise.all([
      prisma.merchantMappingCache.findMany({
        where: { connection_id: connection.id },
        select: {
          id: true,
          mercury_merchant_name: true,
          normalized_merchant_name: true,
          mapping_confidence: true,
          confidence_score: true,
          mapped_by: true,
          mapped_at: true,
          last_transaction_date: true,
          contractor_id: true,
          agency_id: true,
          subscription_id: true,
          client_id: true,
          expense_category_id: true,
          staff_id: true,
          mapping_mode: true,
        },
        orderBy: { last_transaction_date: { sort: 'desc', nulls: 'last' } },
      }),
      prisma.contractor.findMany({
        where: { organization_id: organizationId, deleted_at: null, engagement_type: { not: 'OWNER' } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.agency.findMany({
        where: { organization_id: organizationId, deleted_at: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.subscription.findMany({
        where: { organization_id: organizationId, deleted_at: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.client.findMany({
        where: { organization_id: organizationId, deleted_at: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.vendorExpenseCategory.findMany({
        where: { organization_id: organizationId, deleted_at: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.staff.findMany({
        where: { organization_id: organizationId, engagement_type: 'OWNER', deleted_at: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    // Enrich with display names via in-memory lookup
    const contractorMap = new Map(contractors.map((c) => [c.id, c.name]));
    const agencyMap = new Map(agencies.map((a) => [a.id, a.name]));
    const subscriptionMap = new Map(subscriptions.map((s) => [s.id, s.name]));
    const clientMap = new Map(allClients.map((c) => [c.id, c.name]));
    const categoryMap = new Map(expenseCategories.map((c) => [c.id, c.name]));
    const staffMap = new Map(ownerStaff.map((s) => [s.id, s.name]));

    const mappings = rawMappings.map((m) => ({
      ...m,
      contractor_name: m.contractor_id ? (contractorMap.get(m.contractor_id) ?? null) : null,
      agency_name: m.agency_id ? (agencyMap.get(m.agency_id) ?? null) : null,
      subscription_name: m.subscription_id ? (subscriptionMap.get(m.subscription_id) ?? null) : null,
      client_name: m.client_id ? (clientMap.get(m.client_id) ?? null) : null,
      expense_category_name: m.expense_category_id ? (categoryMap.get(m.expense_category_id) ?? null) : null,
      staff_name: m.staff_id ? (staffMap.get(m.staff_id) ?? null) : null,
    }));

    return NextResponse.json({ mappings, contractors, agencies, subscriptions, expenseCategories, ownerStaff });
  } catch (error: unknown) {
    console.error('Error fetching all merchant mappings:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
