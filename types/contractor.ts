import { Contractor, ContractorAssignment } from '@prisma/client';

/** Contractor with Decimal fields converted to plain numbers for RSC serialization */
export type ContractorWithUtilization = Omit<Contractor, 'rate'> & {
  rate: number | null;
  utilization: number;
  active_assignments: Array<ContractorAssignment & { client: { id: string; name: string } }>;
  assignments_count: number;
};
