'use server';

import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';
import { revalidatePath } from 'next/cache';
import {
  createStaffSchema,
  updateStaffSchema,
  createStaffAssignmentSchema,
  endStaffAssignmentSchema,
  terminateStaffSchema,
  rehireStaffSchema,
  getStaffSchema,
  upsertMonthlyAllocationSchema,
  deleteMonthlyAllocationSchema,
} from '@/lib/validations/staff';
import { Prisma } from '@prisma/client';
import { calculateBillRate, getEffectiveMarkup } from '@/lib/calculations/markup-calculations';

// T074: createStaff server action using CreateStaffSchema
export async function createStaff(data: unknown) {
  const validated = createStaffSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Check for duplicate name within organization
  const existing = await prisma.staff.findFirst({
    where: {
      organization_id: organizationId,
      name: { equals: validated.name, mode: 'insensitive' },
      deleted_at: null,
    },
  });

  if (existing) throw new Error('A staff member with this name already exists');

  // Ensure agency_id and contractor_id are mutually exclusive
  if (validated.agency_id && validated.contractor_id) {
    throw new Error('Staff cannot be associated with both an agency and a contractor');
  }

  // If agency_id provided, verify it exists and fetch markup config
  let agencyMarkup: { markup_type: string | null; markup_value: number | string | null; markup_basis: string | null } | null = null;
  if (validated.agency_id) {
    const agencyRecord = await prisma.agency.findFirst({
      where: { id: validated.agency_id, organization_id: organizationId, deleted_at: null },
      select: { id: true, markup_type: true, markup_value: true, markup_basis: true },
    });
    if (!agencyRecord) throw new Error('Agency not found');
    agencyMarkup = {
      markup_type: agencyRecord.markup_type,
      markup_value: agencyRecord.markup_value != null ? Number(agencyRecord.markup_value) : null,
      markup_basis: agencyRecord.markup_basis,
    };
  }

  // If contractor_id provided, verify it exists
  if (validated.contractor_id) {
    const contractor = await prisma.contractor.findFirst({
      where: { id: validated.contractor_id, organization_id: organizationId, deleted_at: null },
    });
    if (!contractor) throw new Error('Contractor not found');
  }

  // Feature 14: Auto-calculate bill rate for agency staff
  let finalRate = validated.rate;
  const isAgencyStaff = validated.engagement_type === 'AGENCY' && agencyMarkup;
  if (isAgencyStaff && validated.true_cost && validated.true_cost_rate_type && !validated.rate_locked) {
    const effectiveMarkup = getEffectiveMarkup(
      {
        rate_locked: validated.rate_locked ?? false,
        markup_override_type: validated.markup_override_type ?? null,
        markup_override_value: validated.markup_override_value ?? null,
      },
      agencyMarkup
    );

    if (effectiveMarkup.markupType && effectiveMarkup.markupValue != null) {
      const { billRate } = calculateBillRate({
        trueCost: validated.true_cost,
        trueCostRateType: validated.true_cost_rate_type as 'HOURLY' | 'DAILY' | 'MONTHLY' | 'VARIABLE',
        markupType: effectiveMarkup.markupType,
        markupValue: effectiveMarkup.markupValue,
        markupBasis: effectiveMarkup.markupBasis ?? 'BASE_PAY',
      });
      finalRate = billRate;
    }
  }

  const staff = await prisma.staff.create({
    data: {
      organization_id: organizationId,
      name: validated.name,
      staff_type: validated.staff_type,
      rate: finalRate,
      rate_type: validated.rate_type,
      engagement_type: validated.engagement_type,
      agency_id: validated.agency_id,
      contractor_id: validated.contractor_id,
      // Feature 14: True cost and markup fields (agency staff only)
      ...(isAgencyStaff && {
        true_cost: validated.true_cost ?? null,
        true_cost_rate_type: validated.true_cost_rate_type ?? null,
        markup_override_type: validated.markup_override_type ?? null,
        markup_override_value: validated.markup_override_value ?? null,
        rate_locked: validated.rate_locked ?? false,
      }),
    },
  });

  revalidatePath('/dashboard/staff');
  return staff;
}

// T075: getStaff server action with type and agency filters
export async function getStaff(input?: unknown) {
  const validated = input ? getStaffSchema.parse(input) : getStaffSchema.parse({});
  const organizationId = await getOrganizationId();

  const where: Prisma.StaffWhereInput = {
    organization_id: organizationId,
    deleted_at: validated.include_deleted ? undefined : null,
  };

  if (validated.staff_type) {
    where.staff_type = validated.staff_type;
  }

  if (validated.agency_id) {
    where.agency_id = validated.agency_id;
  }

  if (validated.has_agency === true) {
    where.agency_id = { not: null };
  }

  if (validated.status) {
    where.status = validated.status;
  }

  const page = validated.page || 1;
  const limit = validated.limit || 20;
  const skip = (page - 1) * limit;

  const [staffRaw, total] = await Promise.all([
    prisma.staff.findMany({
      where,
      include: {
        agency: { select: { id: true, name: true } },
        contractor: { select: { id: true, name: true } },
        assignments: {
          where: { end_date: null }, // Active assignments only
          include: {
            client: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { [validated.sort_by || 'created_at']: validated.sort_order || 'desc' },
      skip,
      take: limit,
    }),
    prisma.staff.count({ where }),
  ]);

  // Convert Prisma Decimal fields to plain numbers for RSC serialization
  const staff = staffRaw.map((s) => ({
    ...s,
    rate: Number(s.rate),
    assignments: s.assignments.map((a) => ({
      ...a,
      allocation_percentage: Number(a.allocation_percentage),
    })),
  }));

  return {
    staff,
    pagination: {
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// T076: getStaffById server action with assignment inclusions
export async function getStaffById(id: string) {
  const organizationId = await getOrganizationId();

  const staffRaw = await prisma.staff.findFirst({
    where: { id, organization_id: organizationId, deleted_at: null },
    include: {
      agency: true,
      contractor: true,
      assignments: {
        include: {
          client: true,
          monthly_overrides: {
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
          },
        },
        orderBy: { start_date: 'desc' },
      },
      productivity: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 12, // Last 12 months
      },
      bonuses: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { created_at: 'desc' }],
      },
      reimbursements: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { created_at: 'desc' }],
      },
    },
  });

  if (!staffRaw) return null;

  // Convert Prisma Decimal fields to plain numbers for RSC serialization
  return {
    ...staffRaw,
    rate: Number(staffRaw.rate),
    true_cost: staffRaw.true_cost != null ? Number(staffRaw.true_cost) : null,
    markup_override_value: staffRaw.markup_override_value != null ? Number(staffRaw.markup_override_value) : null,
    agency: staffRaw.agency ? {
      ...staffRaw.agency,
      monthly_payment: staffRaw.agency.monthly_payment ? Number(staffRaw.agency.monthly_payment) : null,
      markup_value: staffRaw.agency.markup_value != null ? Number(staffRaw.agency.markup_value) : null,
    } : null,
    contractor: staffRaw.contractor ? { ...staffRaw.contractor, rate: staffRaw.contractor.rate ? Number(staffRaw.contractor.rate) : null } : null,
    assignments: staffRaw.assignments.map((a) => ({
      ...a,
      allocation_percentage: Number(a.allocation_percentage),
      client: { ...a.client, custom_margin_target: a.client.custom_margin_target ? Number(a.client.custom_margin_target) : null },
      monthly_overrides: a.monthly_overrides.map((o) => ({
        ...o,
        allocation_percentage: Number(o.allocation_percentage),
      })),
    })),
    bonuses: staffRaw.bonuses.map((b) => ({
      ...b,
      amount: Number(b.amount),
    })),
    reimbursements: staffRaw.reimbursements.map((r) => ({
      ...r,
      amount: Number(r.amount),
    })),
  };
}

// T077: createStaffAssignment server action with allocation percentage
// T078: Add allocation percentage sum validation: warn if >100%, don't block
export async function createStaffAssignment(data: unknown) {
  const validated = createStaffAssignmentSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Verify staff exists and belongs to organization
  const staff = await prisma.staff.findFirst({
    where: { id: validated.staff_id, organization_id: organizationId, deleted_at: null },
  });
  if (!staff) throw new Error('Staff member not found');
  if (staff.status === 'TERMINATED') throw new Error('Cannot assign a terminated staff member to a client');

  // Verify client exists and belongs to organization
  const client = await prisma.client.findFirst({
    where: { id: validated.client_id, organization_id: organizationId, deleted_at: null },
  });
  if (!client) throw new Error('Client not found');

  // Check for existing active assignment to prevent duplicates (same staff + client + type)
  const existingAssignment = await prisma.staffAssignment.findFirst({
    where: {
      staff_id: validated.staff_id,
      client_id: validated.client_id,
      assignment_type: validated.assignment_type,
      end_date: null,
    },
  });
  if (existingAssignment) {
    throw new Error(`An active ${validated.assignment_type.toLowerCase()} assignment already exists for this staff member and client`);
  }

  // Calculate current total allocation percentage (T090)
  const activeAssignments = await prisma.staffAssignment.findMany({
    where: {
      staff_id: validated.staff_id,
      end_date: null,
    },
  });

  const currentAllocation = activeAssignments.reduce(
    (sum, assignment) => sum + Number(assignment.allocation_percentage),
    0
  );
  const newAllocation = currentAllocation + validated.allocation_percentage;

  const assignment = await prisma.staffAssignment.create({
    data: {
      staff_id: validated.staff_id,
      client_id: validated.client_id,
      assignment_type: validated.assignment_type,
      allocation_percentage: validated.allocation_percentage,
      start_date: validated.start_date,
      end_date: validated.end_date,
    },
    include: {
      staff: true,
      client: true,
    },
  });

  revalidatePath('/dashboard/staff');
  revalidatePath(`/dashboard/staff/${validated.staff_id}`);
  revalidatePath('/dashboard/clients');
  revalidatePath(`/dashboard/clients/${validated.client_id}`);

  // T078: Return warning if allocation exceeds 100%
  return {
    assignment,
    warning: newAllocation > 100 ? `Staff utilization is now ${newAllocation}% (exceeds 100%)` : null,
  };
}

// T079: endStaffAssignment server action setting end_date
export async function endStaffAssignment(data: unknown) {
  const validated = endStaffAssignmentSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Verify assignment exists and staff belongs to organization
  const assignment = await prisma.staffAssignment.findUnique({
    where: { id: validated.assignment_id },
    include: { staff: true },
  });

  if (!assignment) throw new Error('Assignment not found');
  if (assignment.staff.organization_id !== organizationId) {
    throw new Error('Assignment not found');
  }

  const updated = await prisma.staffAssignment.update({
    where: { id: validated.assignment_id },
    data: { end_date: validated.end_date },
    include: { staff: true, client: true },
  });

  revalidatePath('/dashboard/staff');
  revalidatePath(`/dashboard/staff/${updated.staff_id}`);
  revalidatePath(`/dashboard/clients/${updated.client_id}`);

  return updated;
}

// T080: distributeAllocationEvenly server action for bulk allocation
export async function distributeAllocationEvenly(staffId: string, clientIds: string[]) {
  const organizationId = await getOrganizationId();

  // Verify staff exists
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, organization_id: organizationId, deleted_at: null },
  });
  if (!staff) throw new Error('Staff member not found');

  if (clientIds.length === 0) {
    throw new Error('At least one client must be selected');
  }

  // Verify all clients exist
  const clients = await prisma.client.findMany({
    where: {
      id: { in: clientIds },
      organization_id: organizationId,
      deleted_at: null,
    },
  });

  if (clients.length !== clientIds.length) {
    throw new Error('One or more clients not found');
  }

  const allocationPercentage = Math.floor(100 / clientIds.length);

  // End all current assignments
  await prisma.staffAssignment.updateMany({
    where: {
      staff_id: staffId,
      end_date: null,
    },
    data: { end_date: new Date() },
  });

  // Create new assignments with equal distribution
  const assignments = await prisma.$transaction(
    clientIds.map((clientId) =>
      prisma.staffAssignment.create({
        data: {
          staff_id: staffId,
          client_id: clientId,
          allocation_percentage: allocationPercentage,
          start_date: new Date(),
        },
        include: { client: true },
      })
    )
  );

  revalidatePath('/dashboard/staff');
  revalidatePath(`/dashboard/staff/${staffId}`);
  clientIds.forEach((clientId) => revalidatePath(`/dashboard/clients/${clientId}`));

  return assignments;
}

// T081: bulkEndAssignments server action for churned clients
export async function bulkEndAssignments(clientId: string, endDate?: Date) {
  const organizationId = await getOrganizationId();

  // Verify client exists
  const client = await prisma.client.findFirst({
    where: { id: clientId, organization_id: organizationId, deleted_at: null },
  });
  if (!client) throw new Error('Client not found');

  const result = await prisma.staffAssignment.updateMany({
    where: {
      client_id: clientId,
      end_date: null,
    },
    data: { end_date: endDate || new Date() },
  });

  revalidatePath('/dashboard/staff');
  revalidatePath('/dashboard/clients');
  revalidatePath(`/dashboard/clients/${clientId}`);

  return { count: result.count };
}

export async function updateStaff(id: string, data: unknown) {
  const validated = updateStaffSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Check ownership and fetch existing record with agency data
  const existing = await prisma.staff.findFirst({
    where: { id, organization_id: organizationId, deleted_at: null },
    include: { agency: { select: { id: true, markup_type: true, markup_value: true, markup_basis: true } } },
  });
  if (!existing) throw new Error('Staff member not found');

  // Check for duplicate name (excluding current staff)
  if (validated.name) {
    const duplicate = await prisma.staff.findFirst({
      where: {
        organization_id: organizationId,
        name: { equals: validated.name, mode: 'insensitive' },
        id: { not: id },
        deleted_at: null,
      },
    });
    if (duplicate) throw new Error('A staff member with this name already exists');
  }

  // Feature 14: Build true cost and markup update data
  const trueCostData: Record<string, unknown> = {};
  if (validated.true_cost !== undefined) trueCostData.true_cost = validated.true_cost ?? null;
  if (validated.true_cost_rate_type !== undefined) trueCostData.true_cost_rate_type = validated.true_cost_rate_type ?? null;
  if (validated.markup_override_type !== undefined) trueCostData.markup_override_type = validated.markup_override_type ?? null;
  if (validated.markup_override_value !== undefined) trueCostData.markup_override_value = validated.markup_override_value ?? null;
  if (validated.rate_locked !== undefined) trueCostData.rate_locked = validated.rate_locked;

  // Feature 14: Auto-recalculate rate if not locked and true cost/markup changed
  let rateOverride: number | undefined;
  const isAgencyStaff = existing.engagement_type === 'AGENCY' || validated.engagement_type === 'AGENCY';
  const effectiveRateLocked = validated.rate_locked ?? existing.rate_locked;

  if (isAgencyStaff && !effectiveRateLocked) {
    const effectiveTrueCost = validated.true_cost ?? (existing.true_cost ? Number(existing.true_cost) : null);
    const effectiveTrueCostRateType = validated.true_cost_rate_type ?? existing.true_cost_rate_type;

    if (effectiveTrueCost && effectiveTrueCostRateType) {
      const agencyForMarkup = existing.agency ? {
        markup_type: existing.agency.markup_type,
        markup_value: existing.agency.markup_value != null ? Number(existing.agency.markup_value) : null,
        markup_basis: existing.agency.markup_basis,
      } : null;
      const effectiveMarkup = getEffectiveMarkup(
        {
          rate_locked: false,
          markup_override_type: validated.markup_override_type !== undefined ? validated.markup_override_type : existing.markup_override_type,
          markup_override_value: validated.markup_override_value !== undefined ? validated.markup_override_value : (existing.markup_override_value != null ? Number(existing.markup_override_value) : null),
        },
        agencyForMarkup
      );

      if (effectiveMarkup.markupType && effectiveMarkup.markupValue != null) {
        const { billRate } = calculateBillRate({
          trueCost: effectiveTrueCost,
          trueCostRateType: effectiveTrueCostRateType as 'HOURLY' | 'DAILY' | 'MONTHLY' | 'VARIABLE',
          markupType: effectiveMarkup.markupType,
          markupValue: effectiveMarkup.markupValue,
          markupBasis: effectiveMarkup.markupBasis ?? 'BASE_PAY',
        });
        rateOverride = billRate;
      }
    }
  }

  const staff = await prisma.staff.update({
    where: { id },
    data: {
      ...(validated.name && { name: validated.name }),
      ...(validated.staff_type && { staff_type: validated.staff_type }),
      ...(validated.rate !== undefined && { rate: validated.rate }),
      ...(rateOverride !== undefined && { rate: rateOverride }),
      ...(validated.rate_type && { rate_type: validated.rate_type }),
      ...(validated.engagement_type && { engagement_type: validated.engagement_type }),
      ...(validated.agency_id !== undefined && { agency_id: validated.agency_id }),
      ...(validated.contractor_id !== undefined && { contractor_id: validated.contractor_id }),
      ...trueCostData,
    },
  });

  revalidatePath('/dashboard/staff');
  revalidatePath(`/dashboard/staff/${id}`);
  return staff;
}

/**
 * Get payment history for a staff member from approved/paid agency invoices.
 * Returns line items grouped by month/year with invoice status.
 */
export async function getStaffPaymentHistory(staffId: string) {
  const organizationId = await getOrganizationId();

  // Verify staff belongs to org
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, organization_id: organizationId, deleted_at: null },
    select: { id: true },
  });
  if (!staff) throw new Error('Staff member not found');

  const lineItems = await prisma.agencyInvoiceLineItem.findMany({
    where: {
      staff_id: staffId,
      invoice: {
        status: { in: ['APPROVED', 'PAID'] },
      },
    },
    include: {
      invoice: {
        select: {
          id: true,
          month: true,
          year: true,
          status: true,
          agency: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  // Group by month/year
  const grouped = new Map<string, {
    month: number;
    year: number;
    agencyName: string;
    invoiceStatus: string;
    basePay: number;
    bonuses: number;
    reimbursements: number;
    services: number;
    other: number;
    total: number;
  }>();

  for (const item of lineItems) {
    const key = `${item.invoice.year}-${item.invoice.month}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        month: item.invoice.month,
        year: item.invoice.year,
        agencyName: item.invoice.agency.name,
        invoiceStatus: item.invoice.status,
        basePay: 0,
        bonuses: 0,
        reimbursements: 0,
        services: 0,
        other: 0,
        total: 0,
      });
    }
    const entry = grouped.get(key)!;
    const amount = Number(item.amount);

    switch (item.type) {
      case 'STAFF_COST':
        entry.basePay += amount;
        break;
      case 'BONUS':
        entry.bonuses += amount;
        break;
      case 'REIMBURSEMENT':
        entry.reimbursements += amount;
        break;
      case 'SERVICE':
        entry.services += amount;
        break;
      default:
        entry.other += amount;
        break;
    }
    entry.total += amount;
  }

  // Sort by year desc, month desc
  const history = [...grouped.values()].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  return history;
}

/**
 * Upsert a monthly allocation override for a staff assignment.
 * Creates a new override if none exists for the given month/year,
 * or updates the existing one.
 */
export async function upsertMonthlyAllocation(data: unknown) {
  const validated = upsertMonthlyAllocationSchema.parse(data);
  const organizationId = await getOrganizationId();

  const assignment = await prisma.staffAssignment.findUnique({
    where: { id: validated.assignment_id },
    include: { staff: true },
  });
  if (!assignment || assignment.staff.organization_id !== organizationId) {
    throw new Error('Assignment not found');
  }

  const result = await prisma.monthlyAllocationOverride.upsert({
    where: {
      assignment_id_month_year: {
        assignment_id: validated.assignment_id,
        month: validated.month,
        year: validated.year,
      },
    },
    update: { allocation_percentage: validated.allocation_percentage },
    create: {
      assignment_id: validated.assignment_id,
      month: validated.month,
      year: validated.year,
      allocation_percentage: validated.allocation_percentage,
    },
  });

  revalidatePath(`/dashboard/staff/${assignment.staff_id}`);
  revalidatePath(`/dashboard/clients/${assignment.client_id}`);
  return result;
}

/**
 * Delete a monthly allocation override, reverting to the base allocation for that month.
 */
export async function deleteMonthlyAllocation(data: unknown) {
  const validated = deleteMonthlyAllocationSchema.parse(data);
  const organizationId = await getOrganizationId();

  const assignment = await prisma.staffAssignment.findUnique({
    where: { id: validated.assignment_id },
    include: { staff: true },
  });
  if (!assignment || assignment.staff.organization_id !== organizationId) {
    throw new Error('Assignment not found');
  }

  await prisma.monthlyAllocationOverride.delete({
    where: {
      assignment_id_month_year: {
        assignment_id: validated.assignment_id,
        month: validated.month,
        year: validated.year,
      },
    },
  });

  revalidatePath(`/dashboard/staff/${assignment.staff_id}`);
  revalidatePath(`/dashboard/clients/${assignment.client_id}`);
}

export async function softDeleteStaff(id: string) {
  const organizationId = await getOrganizationId();

  const existing = await prisma.staff.findFirst({
    where: { id, organization_id: organizationId, deleted_at: null },
  });
  if (!existing) throw new Error('Staff member not found');

  const staff = await prisma.staff.update({
    where: { id },
    data: { deleted_at: new Date() },
  });

  revalidatePath('/dashboard/staff');
  return staff;
}

/**
 * Terminate a staff member: sets status to TERMINATED, records reason and date,
 * and auto-ends all active assignments in a single transaction.
 * All historical data (assignments, bonuses, reimbursements, payments) is preserved.
 */
export async function terminateStaff(data: unknown) {
  const validated = terminateStaffSchema.parse(data);
  const organizationId = await getOrganizationId();

  const existing = await prisma.staff.findFirst({
    where: {
      id: validated.staff_id,
      organization_id: organizationId,
      deleted_at: null,
      status: 'ACTIVE',
    },
    include: {
      assignments: { where: { end_date: null } },
    },
  });
  if (!existing) throw new Error('Active staff member not found');

  const result = await prisma.$transaction(async (tx) => {
    // End all active assignments with the termination date
    if (existing.assignments.length > 0) {
      await tx.staffAssignment.updateMany({
        where: {
          staff_id: validated.staff_id,
          end_date: null,
        },
        data: { end_date: validated.terminated_at },
      });
    }

    // Update staff status
    const staff = await tx.staff.update({
      where: { id: validated.staff_id },
      data: {
        status: 'TERMINATED',
        terminated_at: validated.terminated_at,
        termination_reason: validated.termination_reason,
      },
    });

    return {
      staff,
      assignmentsEnded: existing.assignments.length,
    };
  });

  revalidatePath('/dashboard/staff');
  revalidatePath(`/dashboard/staff/${validated.staff_id}`);
  for (const assignment of existing.assignments) {
    revalidatePath(`/dashboard/clients/${assignment.client_id}`);
  }

  return result;
}

/**
 * Rehire a terminated staff member: sets status back to ACTIVE,
 * clears termination date and reason.
 */
export async function rehireStaff(data: unknown) {
  const validated = rehireStaffSchema.parse(data);
  const organizationId = await getOrganizationId();

  const existing = await prisma.staff.findFirst({
    where: {
      id: validated.staff_id,
      organization_id: organizationId,
      deleted_at: null,
      status: 'TERMINATED',
    },
  });
  if (!existing) throw new Error('Terminated staff member not found');

  const staff = await prisma.staff.update({
    where: { id: validated.staff_id },
    data: {
      status: 'ACTIVE',
      terminated_at: null,
      termination_reason: null,
    },
  });

  revalidatePath('/dashboard/staff');
  revalidatePath(`/dashboard/staff/${validated.staff_id}`);

  return staff;
}
