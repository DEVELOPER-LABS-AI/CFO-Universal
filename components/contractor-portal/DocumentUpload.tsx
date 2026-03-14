'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Upload,
  Trash2,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  uploadDocument,
  deleteDocument,
  getDocumentUrl,
} from '@/app/actions/contractor-document-actions'
import { documentFileValidation } from '@/lib/validations/contractor-invoice'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DocumentType = 'SOW' | 'INVOICE' | 'TAX_FORM' | 'OTHER'

interface DocumentRecord {
  id: string
  document_type: string
  file_name: string
  file_size: number
  mime_type: string
  uploaded_at: Date | string
}

interface DocumentUploadProps {
  invoiceId: string
  /** Documents already uploaded for this invoice. */
  documents: DocumentRecord[]
  /** Whether the invoice is in DRAFT status (editable). */
  isDraft: boolean
  /** Required document types that must be uploaded. */
  requiredDocTypes?: string[]
  /** Called when document list changes. */
  onDocumentsChanged?: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  SOW: 'Statement of Work',
  INVOICE: 'Invoice',
  TAX_FORM: 'Tax Form (W-9)',
  OTHER: 'Other',
}

const ALLOWED_EXTENSIONS = '.pdf,.docx,.png,.jpg,.jpeg'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format bytes into a human-readable string. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Validate a file against size and MIME type constraints. */
function validateFile(file: File): string | null {
  if (file.size > documentFileValidation.maxSize) {
    return `File exceeds maximum size of ${formatFileSize(documentFileValidation.maxSize)}.`
  }

  const allowed = documentFileValidation.allowedMimeTypes as readonly string[]
  if (!allowed.includes(file.type)) {
    return 'Invalid file type. Allowed: PDF, DOCX, PNG, JPG.'
  }

  return null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentUpload({
  invoiceId,
  documents,
  isDraft,
  requiredDocTypes = [],
  onDocumentsChanged,
}: DocumentUploadProps) {
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('INVOICE')
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // -----------------------------------------------------------------------
  // Upload handler
  // -----------------------------------------------------------------------

  const handleUpload = useCallback(
    async (file: File) => {
      setError(null)

      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        return
      }

      setIsUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('invoice_id', invoiceId)
        formData.append('document_type', selectedDocType)

        const result = await uploadDocument(formData)

        if (!result.success) {
          setError(result.error || 'Upload failed')
          return
        }

        onDocumentsChanged?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
      } finally {
        setIsUploading(false)
        // Reset file input so re-selecting the same file triggers change
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [invoiceId, selectedDocType, onDocumentsChanged],
  )

  // -----------------------------------------------------------------------
  // Drag-and-drop handlers
  // -----------------------------------------------------------------------

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)

      const file = e.dataTransfer.files[0]
      if (file) {
        handleUpload(file)
      }
    },
    [handleUpload],
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleUpload(file)
      }
    },
    [handleUpload],
  )

  // -----------------------------------------------------------------------
  // Delete handler
  // -----------------------------------------------------------------------

  const handleDelete = useCallback(
    async (documentId: string) => {
      setError(null)
      setDeletingId(documentId)

      try {
        const result = await deleteDocument(documentId)

        if (!result.success) {
          setError(result.error || 'Delete failed')
          return
        }

        onDocumentsChanged?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Delete failed. Please try again.')
      } finally {
        setDeletingId(null)
      }
    },
    [onDocumentsChanged],
  )

  // -----------------------------------------------------------------------
  // View document handler
  // -----------------------------------------------------------------------

  const handleViewDocument = useCallback(async (documentId: string) => {
    try {
      const result = await getDocumentUrl(documentId)

      if (!result.success) {
        setError(result.error || 'Could not retrieve document URL.')
        return
      }

      if (result.data?.url) {
        window.open(result.data.url, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not retrieve document URL.')
    }
  }, [])

  // -----------------------------------------------------------------------
  // Required document type status
  // -----------------------------------------------------------------------

  const uploadedTypes = new Set(documents.map((d) => d.document_type))

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Required document indicators */}
      {requiredDocTypes.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Required Documents
          </p>
          <div className="flex flex-wrap gap-2">
            {requiredDocTypes.map((docType) => {
              const isUploaded = uploadedTypes.has(docType)
              const label =
                DOCUMENT_TYPE_LABELS[docType as DocumentType] ?? docType

              return (
                <span
                  key={docType}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                    isUploaded
                      ? 'bg-green-50 text-green-700'
                      : 'bg-amber-50 text-amber-700',
                  )}
                >
                  {isUploaded ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <AlertCircle className="h-3 w-3" />
                  )}
                  {label}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Upload area (only shown when invoice is in DRAFT status) */}
      {isDraft && (
        <div className="space-y-3">
          {/* Document type selector */}
          <div className="flex items-center gap-3">
            <label
              htmlFor="doc-type-select"
              className="text-sm font-medium text-gray-700 whitespace-nowrap"
            >
              Document type
            </label>
            <select
              id="doc-type-select"
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value as DocumentType)}
              className="block w-full max-w-xs rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map(
                (type) => (
                  <option key={type} value={type}>
                    {DOCUMENT_TYPE_LABELS[type]}
                  </option>
                ),
              )}
            </select>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={cn(
              'relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors',
              isDragOver
                ? 'border-violet-400 bg-violet-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
              isUploading && 'pointer-events-none opacity-60',
            )}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                <p className="mt-2 text-sm text-gray-600">Uploading...</p>
              </>
            ) : (
              <>
                <Upload
                  className={cn(
                    'h-8 w-8',
                    isDragOver ? 'text-violet-500' : 'text-gray-400',
                  )}
                />
                <p className="mt-2 text-sm text-gray-600">
                  <span className="font-medium text-violet-600">
                    Click to upload
                  </span>{' '}
                  or drag and drop
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  PDF, DOCX, PNG, or JPG (max 10 MB)
                </p>
              </>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_EXTENSIONS}
              onChange={handleFileSelect}
              className="hidden"
              aria-label="Upload document"
            />
          </div>
        </div>
      )}

      {/* Document list */}
      {documents.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Uploaded Documents
          </p>
          <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
            {documents.map((doc) => {
              const typeLabel =
                DOCUMENT_TYPE_LABELS[doc.document_type as DocumentType] ??
                doc.document_type
              const isDeleting = deletingId === doc.id

              return (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => handleViewDocument(doc.id)}
                        className="truncate text-sm font-medium text-violet-600 hover:text-violet-800 hover:underline"
                        title={doc.file_name}
                      >
                        {doc.file_name}
                      </button>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                          {typeLabel}
                        </span>
                        <span>{formatFileSize(doc.file_size)}</span>
                      </div>
                    </div>
                  </div>

                  {isDraft && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0 text-gray-400 hover:text-red-600"
                      onClick={() => handleDelete(doc.id)}
                      disabled={isDeleting}
                      aria-label={`Delete ${doc.file_name}`}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Empty state when no documents and not draft */}
      {documents.length === 0 && !isDraft && (
        <p className="text-sm text-gray-500">No documents uploaded.</p>
      )}
    </div>
  )
}
