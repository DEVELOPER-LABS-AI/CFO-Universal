-- ============================================================================
-- Feature 6: Contractor Payment Portal — Document Storage
-- Creates contractor-documents bucket and RLS policies
-- ============================================================================

-- Create the storage bucket for contractor documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contractor-documents',
  'contractor-documents',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- RLS Policies for contractor-documents bucket
-- ============================================================================

-- Policy: Contractors can upload to their own folder
-- Path pattern: {organization_id}/{contractor_id}/{invoice_id}/{filename}
CREATE POLICY "contractors_upload_own_docs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contractor-documents'
  AND (
    -- Admin users can upload for any contractor in their org
    EXISTS (
      SELECT 1 FROM public."UserProfile" up
      JOIN public."UserOrganization" uo ON uo.user_id = up.user_id
      WHERE up.user_id = auth.uid()
      AND up.role IN ('ADMIN', 'OWNER')
      AND (storage.foldername(name))[1] = uo.organization_id
    )
    OR
    -- Contractors can upload to their own folder
    EXISTS (
      SELECT 1 FROM public."UserProfile" up
      JOIN public."Contractor" c ON c.id = up.contractor_id
      WHERE up.user_id = auth.uid()
      AND up.role = 'CONTRACTOR'
      AND (storage.foldername(name))[1] = c.organization_id
      AND (storage.foldername(name))[2] = c.id
    )
  )
);

-- Policy: Contractors can read their own documents; admins can read all in their org
CREATE POLICY "contractors_read_own_docs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'contractor-documents'
  AND (
    -- Admin users can read any doc in their org
    EXISTS (
      SELECT 1 FROM public."UserProfile" up
      JOIN public."UserOrganization" uo ON uo.user_id = up.user_id
      WHERE up.user_id = auth.uid()
      AND up.role IN ('ADMIN', 'OWNER')
      AND (storage.foldername(name))[1] = uo.organization_id
    )
    OR
    -- Contractors can read their own docs
    EXISTS (
      SELECT 1 FROM public."UserProfile" up
      JOIN public."Contractor" c ON c.id = up.contractor_id
      WHERE up.user_id = auth.uid()
      AND up.role = 'CONTRACTOR'
      AND (storage.foldername(name))[1] = c.organization_id
      AND (storage.foldername(name))[2] = c.id
    )
  )
);

-- Policy: Contractors can delete their own documents (only on DRAFT invoices, enforced at app level)
CREATE POLICY "contractors_delete_own_docs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'contractor-documents'
  AND (
    -- Admin users can delete any doc in their org
    EXISTS (
      SELECT 1 FROM public."UserProfile" up
      JOIN public."UserOrganization" uo ON uo.user_id = up.user_id
      WHERE up.user_id = auth.uid()
      AND up.role IN ('ADMIN', 'OWNER')
      AND (storage.foldername(name))[1] = uo.organization_id
    )
    OR
    -- Contractors can delete their own docs
    EXISTS (
      SELECT 1 FROM public."UserProfile" up
      JOIN public."Contractor" c ON c.id = up.contractor_id
      WHERE up.user_id = auth.uid()
      AND up.role = 'CONTRACTOR'
      AND (storage.foldername(name))[1] = c.organization_id
      AND (storage.foldername(name))[2] = c.id
    )
  )
);
