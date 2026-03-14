import { Client, Service, ContractorAssignment, Contractor } from '@prisma/client';

export type ClientWithServices = Client & {
  client_services: Array<{ service_id: string; service: Pick<Service, 'id' | 'name'> }>;
  total_revenue?: number;
};

export type ClientWithRelations = Client & {
  client_services: Array<{ service: Service }>;
  contractor_assignments: Array<ContractorAssignment & { contractor: Contractor }>;
};
