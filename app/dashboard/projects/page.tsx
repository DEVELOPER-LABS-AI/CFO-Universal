import { getProjects, getClientsForProjectSelect } from '@/app/actions/project-management';
import { getPortfolioSummary } from '@/app/actions/project-metrics';
import { AddProjectModal } from '@/components/projects/AddProjectModal';
import { ProjectPortfolioSummary } from '@/components/projects/ProjectPortfolioSummary';
import { ProjectTable } from '@/components/projects/ProjectTable';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default async function ProjectsPage() {
  const [projects, clients, summary] = await Promise.all([
    getProjects(),
    getClientsForProjectSelect(),
    getPortfolioSummary(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">
            Track resource allocation and costs across projects
          </p>
        </div>
        <AddProjectModal
          clients={clients}
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Project
            </Button>
          }
        />
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-gray-100 p-4 mb-4">
            <Plus className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">No projects yet</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md">
            Create your first project to start tracking resource allocation and costs.
          </p>
        </div>
      ) : (
        <>
          <ProjectPortfolioSummary summary={summary} />
          <ProjectTable projects={projects} clients={clients} />
        </>
      )}
    </div>
  );
}
