import { notFound } from 'next/navigation';
import { getProject, getClientsForProjectSelect } from '@/app/actions/project-management';
import { getProjectAllocations, getAllocationSourceLists } from '@/app/actions/project-allocation';
import { calculateProjectSnapshot } from '@/app/actions/project-metrics';
import { ProjectHeader } from '@/components/projects/ProjectHeader';
import { CostBreakdownCards } from '@/components/projects/CostBreakdownCards';
import { AllocationTable } from '@/components/projects/AllocationTable';
import { AddAllocationModal } from '@/components/projects/AddAllocationModal';
import { EditProjectModal } from '@/components/projects/EditProjectModal';
import { CostTrendChart } from '@/components/projects/CostTrendChart';
import { RevenueEntryForm } from '@/components/projects/RevenueEntryForm';
import { ProjectSettingsCard } from '@/components/projects/ProjectSettingsCard';
import { Button } from '@/components/ui/button';
import { Plus, Pencil } from 'lucide-react';

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = await params;

  let project;
  try {
    project = await getProject(id);
  } catch {
    notFound();
  }

  // Fetch allocations, source lists, client list, and recalculate snapshot in parallel
  const [allocations, sourceLists, clientList, freshSnapshot] = await Promise.all([
    getProjectAllocations(id),
    getAllocationSourceLists(),
    getClientsForProjectSelect(),
    // Recalculate current month snapshot to ensure costs are up-to-date
    calculateProjectSnapshot(id).catch(() => null),
  ]);

  // Use fresh snapshot data instead of stale data from the initial project fetch
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Merge freshSnapshot into the historical snapshots array so the cards
  // and chart always reflect the latest calculation for the current month
  const allSnapshots = freshSnapshot
    ? [
        // Replace or append the current month snapshot with freshly calculated data
        ...project.cost_snapshots.filter(
          (s) => !(s.period_month === currentMonth && s.period_year === currentYear),
        ),
        freshSnapshot,
      ]
    : project.cost_snapshots;

  const currentSnapshot = freshSnapshot
    ?? project.cost_snapshots.find(
      (s) => s.period_month === currentMonth && s.period_year === currentYear,
    )
    ?? null;

  const currentRevenue = currentSnapshot?.revenue ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <ProjectHeader project={project} />
        <EditProjectModal
          project={project}
          clientList={clientList}
          trigger={
            <Button variant="outline" size="sm">
              <Pencil className="mr-2 h-4 w-4" />
              Edit Project
            </Button>
          }
        />
      </div>

      <CostBreakdownCards
        snapshot={currentSnapshot}
        allSnapshots={allSnapshots}
        budgetTarget={project.budget_target}
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Cost Allocations</h2>
          <AddAllocationModal
            projectId={id}
            trigger={
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Allocation
              </Button>
            }
            staffList={sourceLists.staffList}
            contractorList={sourceLists.contractorList}
            subscriptionList={sourceLists.subscriptionList}
          />
        </div>
        <AllocationTable allocations={allocations} projectId={id} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CostTrendChart snapshots={allSnapshots} />
        </div>
        <div className="space-y-6">
          <RevenueEntryForm
            projectId={id}
            currentRevenue={currentRevenue}
            currentMonth={currentMonth}
            currentYear={currentYear}
          />
          <ProjectSettingsCard
            projectId={id}
            budgetTarget={project.budget_target}
            cumulativeCosts={allSnapshots.reduce((sum, s) => sum + s.total_costs, 0)}
          />
        </div>
      </div>
    </div>
  );
}
