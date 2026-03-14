'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { updateSubscription, updateSubscriptionSettings } from '@/app/actions/subscription-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

interface SubscriptionSettingsModalProps {
  trigger: React.ReactNode;
  subscriptionId: string;
  currentSettings: {
    name: string;
    total_cost: number;
    total_seats: number | null;
    allocation_type: string;
    billing_frequency: string;
    is_active: boolean;
    is_enrichment: boolean;
    total_credits: number | null;
    credit_cost_email: number | null;
    credit_cost_phone: number | null;
  };
}

export function SubscriptionSettingsModal({
  trigger,
  subscriptionId,
  currentSettings,
}: SubscriptionSettingsModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Core fields
  const [name, setName] = useState(currentSettings.name);
  const [totalCost, setTotalCost] = useState(String(currentSettings.total_cost));
  const [totalSeats, setTotalSeats] = useState(
    currentSettings.total_seats !== null ? String(currentSettings.total_seats) : ''
  );
  const [isActive, setIsActive] = useState(currentSettings.is_active);

  // Settings fields
  const [allocationType, setAllocationType] = useState(currentSettings.allocation_type);
  const [billingFrequency, setBillingFrequency] = useState(currentSettings.billing_frequency);
  const [isEnrichment, setIsEnrichment] = useState(currentSettings.is_enrichment);
  const [totalCredits, setTotalCredits] = useState<string>(
    currentSettings.total_credits?.toString() ?? ''
  );
  const [creditCostEmail, setCreditCostEmail] = useState<string>(
    currentSettings.credit_cost_email?.toString() ?? ''
  );
  const [creditCostPhone, setCreditCostPhone] = useState<string>(
    currentSettings.credit_cost_phone?.toString() ?? ''
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const parsedSeats = totalSeats ? parseInt(totalSeats) : null;

      // Update core fields and settings in parallel
      await Promise.all([
        updateSubscription(subscriptionId, {
          name,
          total_cost: parseFloat(totalCost),
          total_seats: parsedSeats,
          billing_frequency: billingFrequency,
          is_active: isActive,
        }),
        updateSubscriptionSettings(subscriptionId, {
          allocation_type: allocationType,
          billing_frequency: billingFrequency,
          is_active: isActive,
          is_enrichment: isEnrichment,
          total_credits: totalCredits ? parseInt(totalCredits) : null,
          credit_cost_email: creditCostEmail ? parseFloat(creditCostEmail) : null,
          credit_cost_phone: creditCostPhone ? parseFloat(creditCostPhone) : null,
        }),
      ]);

      toast.success(`${name} updated`);
      setOpen(false);
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to update subscription');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preview: how many emails/phones can total credits buy
  const parsedCredits = parseInt(totalCredits) || 0;
  const parsedEmailCost = parseFloat(creditCostEmail) || 0;
  const parsedPhoneCost = parseFloat(creditCostPhone) || 0;
  const seatCount = totalSeats ? parseInt(totalSeats) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
            <DialogDescription>
              Update subscription details, allocation, and billing settings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Active / Inactive */}
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Checkbox
                id="active-toggle"
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(checked === true)}
              />
              <div>
                <Label htmlFor="active-toggle" className="text-sm font-medium cursor-pointer">
                  Active Subscription
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Inactive subscriptions are excluded from cost summaries and sorted to the bottom
                </p>
              </div>
            </div>

            {/* Core Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sub-name">Subscription Name</Label>
                <Input
                  id="sub-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Salesforce, HubSpot, Adobe Creative Cloud..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sub-cost">Total Cost</Label>
                  <Input
                    id="sub-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={totalCost}
                    onChange={(e) => setTotalCost(e.target.value)}
                    placeholder="500.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sub-seats">
                    Total Seats
                    <span className="text-xs text-muted-foreground ml-1">(optional)</span>
                  </Label>
                  <Input
                    id="sub-seats"
                    type="number"
                    min="1"
                    value={totalSeats}
                    onChange={(e) => setTotalSeats(e.target.value)}
                    placeholder="10"
                  />
                </div>
              </div>
            </div>

            {/* Billing Frequency */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Billing Frequency</Label>
              <RadioGroup value={billingFrequency} onValueChange={setBillingFrequency}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="MONTHLY" id="freq-monthly" />
                  <Label htmlFor="freq-monthly">Monthly</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="QUARTERLY" id="freq-quarterly" />
                  <Label htmlFor="freq-quarterly">Quarterly</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ANNUAL" id="freq-annual" />
                  <Label htmlFor="freq-annual">Annual</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ONE_TIME" id="freq-onetime" />
                  <Label htmlFor="freq-onetime">One-Time</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Allocation Type */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Allocation Type</Label>
              <RadioGroup value={allocationType} onValueChange={setAllocationType}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PERCENTAGE_BASED" id="pct" />
                  <Label htmlFor="pct">Percentage-Based (auto-split evenly)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="SEAT_BASED"
                    id="seat"
                    disabled={!seatCount}
                  />
                  <Label
                    htmlFor="seat"
                    className={!seatCount ? 'opacity-50' : ''}
                  >
                    Seat-Based{!seatCount && ' (set total seats first)'}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Enrichment Toggle */}
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Checkbox
                id="enrichment-toggle"
                checked={isEnrichment}
                onCheckedChange={(checked) => setIsEnrichment(checked === true)}
              />
              <div>
                <Label htmlFor="enrichment-toggle" className="text-sm font-medium cursor-pointer">
                  Enrichment Subscription
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Enable if this subscription provides enrichment credits (e.g. Clay, Apollo)
                </p>
              </div>
            </div>

            {/* Enrichment Fields (shown when enabled) */}
            {isEnrichment && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="space-y-2">
                  <Label htmlFor="total-credits">Total Credits per Billing Period</Label>
                  <Input
                    id="total-credits"
                    type="number"
                    min="0"
                    value={totalCredits}
                    onChange={(e) => setTotalCredits(e.target.value)}
                    placeholder="e.g. 10000"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-cost">Credits per Email Enrichment</Label>
                    <Input
                      id="email-cost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={creditCostEmail}
                      onChange={(e) => setCreditCostEmail(e.target.value)}
                      placeholder="e.g. 1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone-cost">Credits per Phone Enrichment</Label>
                    <Input
                      id="phone-cost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={creditCostPhone}
                      onChange={(e) => setCreditCostPhone(e.target.value)}
                      placeholder="e.g. 5"
                    />
                  </div>
                </div>

                {/* Credit capacity preview */}
                {parsedCredits > 0 && (parsedEmailCost > 0 || parsedPhoneCost > 0) && (
                  <div className="p-3 border rounded-lg bg-background space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Credit Capacity</p>
                    {parsedEmailCost > 0 && (
                      <p className="text-sm">
                        Emails only:{' '}
                        <span className="font-semibold">
                          {Math.floor(parsedCredits / parsedEmailCost).toLocaleString()}
                        </span>{' '}
                        enrichments
                      </p>
                    )}
                    {parsedPhoneCost > 0 && (
                      <p className="text-sm">
                        Phones only:{' '}
                        <span className="font-semibold">
                          {Math.floor(parsedCredits / parsedPhoneCost).toLocaleString()}
                        </span>{' '}
                        enrichments
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
