import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getClientById, getEnrichmentBudget } from '@/app/actions/client-management';
import { getServices } from '@/app/actions/service-management';
import { getStaff } from '@/app/actions/staff-management';
import { getContractors } from '@/app/actions/contractor-management';
import { softDeleteClient } from '@/app/actions/client-management';
import { ClientStatusBadge } from '@/components/clients/ClientStatusBadge';
import { EditClientModal } from '@/components/clients/EditClientModal';
import { DeleteClientButton } from '@/components/clients/DeleteClientButton';
import { ClientStaffTable } from '@/components/clients/ClientStaffTable';
import { AssignStaffToClientModal } from '@/components/clients/AssignStaffToClientModal';
import { AssignContractorToClientModal } from '@/components/clients/AssignContractorToClientModal';
import { formatDate } from '@/lib/utils/date';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RevenueReconciliationPanel } from '@/components/clients/RevenueReconciliationPanel';
import { ClientTransactionsTable } from '@/components/clients/ClientTransactionsTable';
import { ClientEnrichmentGoals } from '@/components/clients/ClientEnrichmentGoals';
import { ClientFinancialSummary } from '@/components/clients/ClientFinancialSummary';
import { AssignServicesModal } from '@/components/clients/AssignServicesModal';
import { ServiceCoverageCard } from '@/components/clients/ServiceCoverageCard';
import { ClientServicesTable } from '@/components/clients/ClientServicesTable';
import { ArrowLeft, Pencil, UserPlus, Plus } from 'lucide-react';

import { EndContractorAssignmentButton } from '@/components/contractors/EndContractorAssignmentButton';

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [client, services, { staff: allStaff }, allContractors, enrichmentBudget] = await Promise.all([
    getClientById(id),
    getServices({ is_active: 'true' }),
    getStaff({ limit: 100 }),
    getContractors(),
    getEnrichmentBudget(),
  ]);

  if (!client) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link href="/dashboard/clients">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Clients
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">{client.name}</h1>
          <div className="flex items-center gap-2">
            <ClientStatusBadge status={client.status} />
            <span className="text-sm text-muted-foreground">Since {formatDate(client.start_date)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <EditClientModal
            client={client}
            services={services}
            trigger={
              <Button variant="outline">
                <Pencil className="mr-2 h-4 w-4" />
                Edit Client
              </Button>
            }
          />
          <DeleteClientButton clientId={client.id} clientName={client.name} />
        </div>
      </div>

      {/* Client context */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Relationship Type</CardDescription>
            <CardTitle className="text-2xl capitalize">
              {client.relationship_type.replace(/_/g, ' ').toLowerCase()}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Margin Target</CardDescription>
            <CardTitle className="text-2xl">
              {client.custom_margin_target ? `${client.custom_margin_target}%` : 'Default'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Financial summary with revenue, costs, profit, and cost breakdown */}
      <ClientFinancialSummary clientId={client.id} />

      {/* Service coverage status */}
      <ServiceCoverageCard clientId={client.id} />

      {/* Services */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Services</CardTitle>
            <CardDescription>Services provided to this client</CardDescription>
          </div>
          <AssignServicesModal
            clientId={client.id}
            clientName={client.name}
            availableServices={services.filter(
              (s) => !client.client_services.some((cs) => cs.service.id === s.id)
            )}
            trigger={
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Service
              </Button>
            }
          />
        </CardHeader>
        <CardContent>
          <ClientServicesTable
            clientId={client.id}
            services={client.client_services}
          />
        </CardContent>
      </Card>

      {/* Enrichment Goals */}
      <ClientEnrichmentGoals
        clientId={client.id}
        clientName={client.name}
        currentEmailsPerMonth={client.enrichment_emails_per_month ?? null}
        currentPhonesPerMonth={client.enrichment_phones_per_month ?? null}
        enrichmentBudget={enrichmentBudget}
      />

      {/* Contractor Assignments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Contractor Assignments</CardTitle>
            <CardDescription>Contractors assigned to this client</CardDescription>
          </div>
          <AssignContractorToClientModal
            clientId={client.id}
            clientName={client.name}
            availableContractors={allContractors
              .filter((c) => c.utilization < 100)
              .map((c) => ({ id: c.id, name: c.name, utilization: c.utilization }))}
            trigger={
              <Button size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Assign Contractor
              </Button>
            }
          />
        </CardHeader>
        <CardContent>
          {client.contractor_assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No assignments yet</p>
          ) : (
            <div className="space-y-4">
              {client.contractor_assignments.map((assignment) => {
                const isActive = !assignment.end_date || new Date(assignment.end_date) >= new Date();
                return (
                  <div key={assignment.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <p className="font-medium">{assignment.contractor.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(assignment.start_date)} -{' '}
                        {assignment.end_date ? formatDate(assignment.end_date) : 'Present'}
                      </p>
                      <p className="text-sm">Allocation: {assignment.allocation_percentage}%</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <Badge variant={isActive ? 'default' : 'secondary'}>
                          {isActive ? 'Active' : 'Ended'}
                        </Badge>
                        <p className="text-sm text-muted-foreground mt-1">
                          {assignment.contractor.rate != null && assignment.contractor.rate_type ? `$${Number(assignment.contractor.rate).toFixed(2)}/${assignment.contractor.rate_type.toLowerCase()}` : 'Rate not set'}
                        </p>
                      </div>
                      {isActive && (
                        <EndContractorAssignmentButton
                          assignmentId={assignment.id}
                          contractorName={assignment.contractor.name}
                          clientName={client.name}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Staff Assignments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Staff Assignments</CardTitle>
            <CardDescription>Staff members assigned to this client</CardDescription>
          </div>
          <AssignStaffToClientModal
            clientId={client.id}
            clientName={client.name}
            availableStaff={allStaff.filter(
              (s) => {
                // Allow staff who don't have BOTH types assigned yet
                const activeAssignments = client.staff_assignments.filter(
                  (a) => a.staff_id === s.id && !a.end_date
                );
                return activeAssignments.length < 2; // Can have 0 or 1 (need room for the other type)
              }
            )}
            trigger={
              <Button size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Assign Staff
              </Button>
            }
          />
        </CardHeader>
        <CardContent>
          <ClientStaffTable
            assignments={client.staff_assignments}
            clientId={client.id}
            showActive={true}
          />
        </CardContent>
      </Card>

      {client.churn_date && (
        <Card>
          <CardHeader>
            <CardTitle>Churn Information</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Churned on {formatDate(client.churn_date)}</p>
          </CardContent>
        </Card>
      )}

      {/* Mercury deposits linked to this client */}
      <ClientTransactionsTable clientId={client.id} clientName={client.name} />

      {/* T045: Revenue reconciliation panel */}
      <RevenueReconciliationPanel clientId={client.id} />
    </div>
  );
}
