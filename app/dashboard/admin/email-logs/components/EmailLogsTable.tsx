'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight } from 'lucide-react'

import type { JsonValue } from '@prisma/client/runtime/library'

interface EmailLog {
  id: string
  to_address: string
  from_address: string
  subject: string
  email_type: string
  status: string
  resend_id: string | null
  error_message: string | null
  metadata: JsonValue
  created_at: Date | string
}

interface EmailLogsTableProps {
  logs: EmailLog[]
}

const EMAIL_TYPE_LABELS: Record<string, string> = {
  invoice_status: 'Invoice Status',
  contractor_reminder: 'Reminder',
  test_email: 'Test Email',
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'invoice_status', label: 'Invoice Status' },
  { value: 'contractor_reminder', label: 'Reminders' },
  { value: 'test_email', label: 'Test Emails' },
] as const

/**
 * Client component for displaying and filtering email logs.
 * Supports type filtering and expandable rows for metadata/error details.
 */
export function EmailLogsTable({ logs }: EmailLogsTableProps) {
  const [filter, setFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.email_type === filter)

  const counts: Record<string, number> = {
    all: logs.length,
    invoice_status: logs.filter((l) => l.email_type === 'invoice_status').length,
    contractor_reminder: logs.filter((l) => l.email_type === 'contractor_reminder').length,
    test_email: logs.filter((l) => l.email_type === 'test_email').length,
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={filter === opt.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(opt.value)}
          >
            {opt.label}
            <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-[10px]">
              {counts[opt.value] ?? 0}
            </span>
          </Button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          No email logs found.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Date</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resend ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => {
                const isExpanded = expandedId === log.id
                const hasDetails = log.metadata || log.error_message

                return (
                  <TableRow
                    key={log.id}
                    className={hasDetails ? 'cursor-pointer' : ''}
                    onClick={() => {
                      if (hasDetails) {
                        setExpandedId(isExpanded ? null : log.id)
                      }
                    }}
                  >
                    <TableCell className="w-8 px-2">
                      {hasDetails && (
                        isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                    </TableCell>
                    <TableCell className="text-sm">{log.to_address}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-sm">{log.subject}</TableCell>
                    <TableCell>
                      <EmailTypeBadge type={log.email_type} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={log.status} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.resend_id ? log.resend_id.slice(0, 12) + '...' : '-'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {/* Expanded detail panel - rendered outside table for valid HTML */}
          {expandedId && (() => {
            const log = filtered.find((l) => l.id === expandedId)
            if (!log) return null
            return (
              <div className="border-t bg-muted/50 px-6 py-4 text-sm">
                {log.error_message && (
                  <div className="mb-3">
                    <span className="font-medium text-destructive">Error: </span>
                    <span className="text-destructive">{log.error_message}</span>
                  </div>
                )}
                {log.metadata && (
                  <div>
                    <span className="font-medium">Details: </span>
                    <pre className="mt-1 rounded bg-muted p-2 text-xs">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </div>
                )}
                <div className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium">From: </span>{log.from_address}
                  {log.resend_id && (
                    <>
                      <span className="mx-2">|</span>
                      <span className="font-medium">Resend ID: </span>{log.resend_id}
                    </>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

function EmailTypeBadge({ type }: { type: string }) {
  const label = EMAIL_TYPE_LABELS[type] ?? type

  const className =
    type === 'invoice_status'
      ? 'bg-blue-100 text-blue-800 border-blue-200'
      : type === 'contractor_reminder'
        ? 'bg-amber-100 text-amber-800 border-amber-200'
        : 'bg-gray-100 text-gray-800 border-gray-200'

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'sent') {
    return (
      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
        Sent
      </Badge>
    )
  }
  return (
    <Badge variant="destructive">
      Failed
    </Badge>
  )
}
