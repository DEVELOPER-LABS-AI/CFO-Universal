'use client'

import { useState, useEffect } from 'react'
import { getMercuryRecipients, linkMercuryRecipient } from '@/app/actions/mercury-recipient-actions'
import { Button } from '@/components/ui/button'
import { Loader2, Link2, Search } from 'lucide-react'

interface MercuryRecipientPickerProps {
  contractorId: string
  currentRecipientId?: string | null
  onLinked?: () => void
}

export function MercuryRecipientPicker({
  contractorId,
  currentRecipientId,
  onLinked,
}: MercuryRecipientPickerProps) {
  const [recipients, setRecipients] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [linking, setLinking] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch recipients from Mercury API
   */
  async function loadRecipients() {
    setLoading(true)
    setError(null)
    const result = await getMercuryRecipients()
    if (result.success) {
      setRecipients(result.data?.recipients || [])
    } else {
      setError(result.error || 'Failed to load recipients')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadRecipients()
  }, [])

  /**
   * Link a recipient to the contractor
   */
  async function handleLink(recipientId: string) {
    setLinking(true)
    const result = await linkMercuryRecipient(contractorId, recipientId)
    if (result.success) {
      onLinked?.()
    } else {
      setError(result.error || 'Failed to link recipient')
    }
    setLinking(false)
  }

  const filtered = recipients.filter((r) =>
    r.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search Mercury recipients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <Button variant="outline" size="sm" onClick={loadRecipients} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {loading ? (
        <div className="text-center py-4">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          No recipients found
        </p>
      ) : (
        <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
          {filtered.map((recipient) => (
            <div
              key={recipient.id}
              className="flex items-center justify-between px-3 py-2 hover:bg-gray-50"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{recipient.name}</p>
                <p className="text-xs text-gray-500">
                  {recipient.defaultPaymentMethod} {recipient.emails?.[0] ? `- ${recipient.emails[0]}` : ''}
                </p>
              </div>
              {recipient.id === currentRecipientId ? (
                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> Linked
                </span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleLink(recipient.id)}
                  disabled={linking}
                >
                  {linking ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Link'}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
