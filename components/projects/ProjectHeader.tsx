'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { updateProject } from '@/app/actions/project-management';
import { formatCurrency } from '@/lib/utils/currency';

interface ProjectHeaderProps {
  project: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    client: { id: string; name: string } | null;
    budget_target: number | null;
    start_date: Date;
    end_date: Date | null;
  };
}

/** Maps each status to the set of statuses it can transition to. */
const STATUS_TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ['UNDER_REVIEW', 'ARCHIVED'],
  UNDER_REVIEW: ['ACTIVE', 'SUNSET'],
  SUNSET: ['ARCHIVED'],
  ARCHIVED: [],
};

/** Returns Tailwind classes for the status badge based on the current status. */
function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-800';
    case 'UNDER_REVIEW':
      return 'bg-yellow-100 text-yellow-800';
    case 'SUNSET':
      return 'bg-red-100 text-red-800';
    case 'ARCHIVED':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/** Formats a status string for display (e.g. UNDER_REVIEW -> Under Review). */
function formatStatus(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * ProjectHeader displays the project name, status badge, description,
 * metadata row (client, budget, dates), and a status-change dropdown.
 */
export function ProjectHeader({ project }: ProjectHeaderProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const allowedTransitions = STATUS_TRANSITIONS[project.status] ?? [];
  const isDisabled = allowedTransitions.length === 0 || isUpdating;

  /**
   * Handles status changes by calling the updateProject server action,
   * showing a toast on success or error, and refreshing the page data.
   */
  async function handleStatusChange(newStatus: string): Promise<void> {
    if (newStatus === project.status) return;

    setIsUpdating(true);
    try {
      await updateProject(project.id, { status: newStatus });
      toast({
        title: 'Status updated',
        description: `Project status changed to ${formatStatus(newStatus)}.`,
      });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to update project status.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Name and status badge */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClasses(project.status)}`}
        >
          {formatStatus(project.status)}
        </span>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-muted-foreground">{project.description}</p>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        {project.client && (
          <span>
            Client:{' '}
            <Link
              href="/dashboard/clients"
              className="underline hover:text-foreground"
            >
              {project.client.name}
            </Link>
          </span>
        )}

        {project.budget_target !== null && (
          <span>Budget: {formatCurrency(project.budget_target)}</span>
        )}

        <span>
          Start: {new Date(project.start_date).toLocaleDateString()}
        </span>

        {project.end_date && (
          <span>
            End: {new Date(project.end_date).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Status change dropdown */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Change status:</span>
        <Select
          value={project.status}
          onValueChange={handleStatusChange}
          disabled={isDisabled}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={project.status}>
              {formatStatus(project.status)}
            </SelectItem>
            {allowedTransitions.map((status) => (
              <SelectItem key={status} value={status}>
                {formatStatus(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
