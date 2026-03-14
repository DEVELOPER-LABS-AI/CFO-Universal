'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type BillingModel = 'CONTRACT' | 'PROJECT' | 'RETAINER';

export interface ContractFormData {
  billing_model: BillingModel;
  start_month: number;
  start_year: number;
  end_month?: number;
  end_year?: number;
  monthly_rate?: number;
  project_fee?: number;
  notes?: string;
}

interface ContractFormFieldsProps {
  value: ContractFormData;
  onChange: (data: ContractFormData) => void;
  standardRate?: number;
}

/**
 * T018: Billing model selection with conditional fields per type.
 * CONTRACT: start/end month-year + monthly rate + auto-calculated total value
 * PROJECT: billing period month/year + project fee
 * RETAINER: start month/year + monthly rate
 */
export function ContractFormFields({ value, onChange, standardRate }: ContractFormFieldsProps) {
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

  const update = (partial: Partial<ContractFormData>) => {
    onChange({ ...value, ...partial });
  };

  // Calculate term months and total value for CONTRACT type
  const termMonths =
    value.billing_model === 'CONTRACT' && value.end_month && value.end_year
      ? (value.end_year - value.start_year) * 12 + (value.end_month - value.start_month) + 1
      : null;

  const totalValue =
    termMonths && termMonths > 0 && value.monthly_rate
      ? value.monthly_rate * termMonths
      : null;

  return (
    <div className="space-y-4">
      {/* Billing Model Selection */}
      <div className="space-y-2">
        <Label>Billing Model</Label>
        <RadioGroup
          value={value.billing_model}
          onValueChange={(v) => update({ billing_model: v as BillingModel })}
          className="grid grid-cols-3 gap-2"
        >
          {([
            { value: 'CONTRACT', label: 'Contract', desc: 'Fixed term' },
            { value: 'PROJECT', label: 'Project', desc: 'One-time fee' },
            { value: 'RETAINER', label: 'Retainer', desc: 'Ongoing' },
          ] as const).map((option) => (
            <label
              key={option.value}
              className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                value.billing_model === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/50'
              }`}
            >
              <RadioGroupItem value={option.value} />
              <div>
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground block">{option.desc}</span>
              </div>
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* Start Date (CONTRACT and RETAINER) */}
      {(value.billing_model === 'CONTRACT' || value.billing_model === 'RETAINER') && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Start Month</Label>
            <Select
              value={String(value.start_month)}
              onValueChange={(v) => update({ start_month: Number(v) })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Start Year</Label>
            <Select
              value={String(value.start_year)}
              onValueChange={(v) => update({ start_year: Number(v) })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* End Date (CONTRACT only — required) */}
      {value.billing_model === 'CONTRACT' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">End Month</Label>
            <Select
              value={value.end_month ? String(value.end_month) : ''}
              onValueChange={(v) => update({ end_month: Number(v) })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">End Year</Label>
            <Select
              value={value.end_year ? String(value.end_year) : ''}
              onValueChange={(v) => update({ end_year: Number(v) })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Billing Period (PROJECT) */}
      {value.billing_model === 'PROJECT' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Billing Month</Label>
            <Select
              value={String(value.start_month)}
              onValueChange={(v) => update({ start_month: Number(v) })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Billing Year</Label>
            <Select
              value={String(value.start_year)}
              onValueChange={(v) => update({ start_year: Number(v) })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Monthly Rate (CONTRACT and RETAINER) */}
      {(value.billing_model === 'CONTRACT' || value.billing_model === 'RETAINER') && (
        <div className="space-y-1.5">
          <Label className="text-xs">Monthly Rate</Label>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder={standardRate ? standardRate.toFixed(2) : '0.00'}
              value={value.monthly_rate !== undefined ? String(value.monthly_rate) : ''}
              onChange={(e) => update({ monthly_rate: e.target.value ? parseFloat(e.target.value) : undefined })}
              className="h-8 text-sm"
            />
          </div>
        </div>
      )}

      {/* Project Fee (PROJECT only) */}
      {value.billing_model === 'PROJECT' && (
        <div className="space-y-1.5">
          <Label className="text-xs">Project Fee</Label>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={value.project_fee !== undefined ? String(value.project_fee) : ''}
              onChange={(e) => update({ project_fee: e.target.value ? parseFloat(e.target.value) : undefined })}
              className="h-8 text-sm"
            />
          </div>
        </div>
      )}

      {/* Contract Summary (CONTRACT type) */}
      {value.billing_model === 'CONTRACT' && termMonths && termMonths > 0 && (
        <div className="rounded-lg bg-muted p-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Term Length</span>
            <span className="font-medium">{termMonths} month{termMonths !== 1 ? 's' : ''}</span>
          </div>
          {totalValue && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Contract Value</span>
              <span className="font-semibold">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-xs">Notes (Optional)</Label>
        <Input
          placeholder="Contract notes..."
          value={value.notes ?? ''}
          onChange={(e) => update({ notes: e.target.value || undefined })}
          className="h-8 text-sm"
        />
      </div>
    </div>
  );
}
