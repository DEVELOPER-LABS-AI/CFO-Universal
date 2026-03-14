'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateGlobalContractorSettings } from '@/app/actions/contractor-admin-actions'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Save } from 'lucide-react'

interface ContractorReminderSettingsProps {
  /** Current reminder day (1-28) */
  reminderDay: number
  /** Current default required document types */
  defaultDocTypes: string[]
}

const DOC_TYPE_OPTIONS = [
  { value: 'SOW', label: 'Statement of Work' },
  { value: 'INVOICE', label: 'Invoice' },
  { value: 'TAX_FORM', label: 'Tax Form (W-9)' },
  { value: 'OTHER', label: 'Other' },
]

/**
 * Organization-level settings for contractor invoice reminders.
 * Controls the default reminder day and required document types.
 */
export function ContractorReminderSettings({ reminderDay, defaultDocTypes }: ContractorReminderSettingsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [day, setDay] = useState(reminderDay)
  const [docTypes, setDocTypes] = useState<string[]>(defaultDocTypes ?? [])
  const [saving, setSaving] = useState(false)

  /**
   * Toggle a document type in the required list.
   */
  function toggleDocType(type: string) {
    setDocTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  /**
   * Save the global contractor settings.
   */
  async function handleSave() {
    setSaving(true)
    const result = await updateGlobalContractorSettings({
      contractor_reminder_day: day,
      contractor_default_doc_types: docTypes,
    })

    if (result.success) {
      toast({ title: 'Settings saved', description: 'Contractor reminder settings updated.' })
      router.refresh()
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      {/* Reminder day */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          Monthly Reminder Day
        </label>
        <p className="text-xs text-gray-500">
          Contractors will receive an email reminder on this day each month to submit their invoices.
        </p>
        <select
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
          className="block w-32 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'}
            </option>
          ))}
        </select>
      </div>

      {/* Default required document types */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          Default Required Documents
        </label>
        <p className="text-xs text-gray-500">
          New contractors will be required to upload these document types with each invoice.
          Can be overridden per contractor.
        </p>
        <div className="space-y-2">
          {DOC_TYPE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={docTypes.includes(opt.value)}
                onChange={() => toggleDocType(opt.value)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Save */}
      <Button onClick={handleSave} disabled={saving}>
        {saving ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
        ) : (
          <><Save className="h-4 w-4" /> Save Settings</>
        )}
      </Button>
    </div>
  )
}
