-- ============================================================================
-- 010_project_rls_policies.sql
-- Feature: 10-project-resource-allocation
-- Date: 2026-03-03
-- Description: RLS policies for project-related tables (projects,
--   project_cost_allocations, project_cost_snapshots).
--   Scoped by organization_id matching the authenticated user's org.
--
-- Idempotency: Safe to run multiple times. Uses DROP POLICY IF EXISTS before
--   every CREATE POLICY.
--
-- Service Role: Supabase service role automatically bypasses all RLS policies.
-- ============================================================================

-- ============================================================================
-- Table: projects
-- Direct organization_id column for scoping
-- ============================================================================

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select_org" ON public.projects;
CREATE POLICY "projects_select_org" ON public.projects
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "projects_insert_org" ON public.projects;
CREATE POLICY "projects_insert_org" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "projects_update_org" ON public.projects;
CREATE POLICY "projects_update_org" ON public.projects
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "projects_delete_org" ON public.projects;
CREATE POLICY "projects_delete_org" ON public.projects
  FOR DELETE TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- ============================================================================
-- Table: project_cost_allocations
-- Scoped via join to projects.organization_id
-- ============================================================================

ALTER TABLE public.project_cost_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_cost_allocations_select_org" ON public.project_cost_allocations;
CREATE POLICY "project_cost_allocations_select_org" ON public.project_cost_allocations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_cost_allocations.project_id
        AND p.organization_id = public.get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "project_cost_allocations_insert_org" ON public.project_cost_allocations;
CREATE POLICY "project_cost_allocations_insert_org" ON public.project_cost_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_cost_allocations.project_id
        AND p.organization_id = public.get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "project_cost_allocations_update_org" ON public.project_cost_allocations;
CREATE POLICY "project_cost_allocations_update_org" ON public.project_cost_allocations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_cost_allocations.project_id
        AND p.organization_id = public.get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "project_cost_allocations_delete_org" ON public.project_cost_allocations;
CREATE POLICY "project_cost_allocations_delete_org" ON public.project_cost_allocations
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_cost_allocations.project_id
        AND p.organization_id = public.get_user_organization_id()
    )
  );

-- ============================================================================
-- Table: project_cost_snapshots
-- Scoped via join to projects.organization_id
-- ============================================================================

ALTER TABLE public.project_cost_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_cost_snapshots_select_org" ON public.project_cost_snapshots;
CREATE POLICY "project_cost_snapshots_select_org" ON public.project_cost_snapshots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_cost_snapshots.project_id
        AND p.organization_id = public.get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "project_cost_snapshots_insert_org" ON public.project_cost_snapshots;
CREATE POLICY "project_cost_snapshots_insert_org" ON public.project_cost_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_cost_snapshots.project_id
        AND p.organization_id = public.get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "project_cost_snapshots_update_org" ON public.project_cost_snapshots;
CREATE POLICY "project_cost_snapshots_update_org" ON public.project_cost_snapshots
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_cost_snapshots.project_id
        AND p.organization_id = public.get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "project_cost_snapshots_delete_org" ON public.project_cost_snapshots;
CREATE POLICY "project_cost_snapshots_delete_org" ON public.project_cost_snapshots
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_cost_snapshots.project_id
        AND p.organization_id = public.get_user_organization_id()
    )
  );
