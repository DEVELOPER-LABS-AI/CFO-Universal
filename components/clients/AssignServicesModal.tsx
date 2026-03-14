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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createServiceContract } from '@/app/actions/service-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';
import type { Service } from '@prisma/client';
import { ContractFormFields, type ContractFormData } from './ContractFormFields';

interface AssignServicesModalProps {
  clientId: string;
  clientName: string;
  availableServices: Service[];
  trigger: React.ReactNode;
}

/**
 * T019: Modal for assigning a service to a client with contract terms.
 * After service selection, shows ContractFormFields for billing model configuration.
 * Calls createServiceContract instead of assignServiceToClient.
 * Displays overlap errors from server response as destructive toast.
 */
export function AssignServicesModal({
  clientId,
  clientName,
  availableServices,
  trigger,
}: AssignServicesModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const now = new Date();
  const [contractData, setContractData] = useState<ContractFormData>({
    billing_model: 'RETAINER',
    start_month: now.getMonth() + 1,
    start_year: now.getFullYear(),
  });

  const selectedService = availableServices.find((s) => s.id === selectedServiceId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServiceId) {
      toast.error('Please select a service');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createServiceContract({
        client_id: clientId,
        service_id: selectedServiceId,
        billing_model: contractData.billing_model,
        start_month: contractData.start_month,
        start_year: contractData.start_year,
        end_month: contractData.end_month,
        end_year: contractData.end_year,
        monthly_rate: contractData.monthly_rate,
        project_fee: contractData.project_fee,
        notes: contractData.notes,
      });

      if (result && 'success' in result && !result.success) {
        toast.error(result.error || 'Failed to create contract', {
          duration: 6000,
        });
        return;
      }

      toast.success(`Contract created for ${clientName}`);
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to create contract');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedServiceId('');
    const n = new Date();
    setContractData({
      billing_model: 'RETAINER',
      start_month: n.getMonth() + 1,
      start_year: n.getFullYear(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Assign Service</DialogTitle>
            <DialogDescription>
              Assign a service to {clientName} with billing terms
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Service Selection */}
            <div className="space-y-2">
              <Label htmlFor="service">Service Template</Label>
              <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                <SelectTrigger id="service">
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {availableServices.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} - ${Number(service.standard_rate).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Standard Rate Display */}
            {selectedService && (
              <div className="rounded-lg bg-muted p-3 space-y-1">
                <p className="text-sm font-medium">Standard Rate</p>
                <p className="text-2xl font-bold">${Number(selectedService.standard_rate).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">
                  Target Margin: {Number(selectedService.target_margin)}%
                </p>
              </div>
            )}

            {/* Contract Form Fields */}
            {selectedServiceId && (
              <ContractFormFields
                value={contractData}
                onChange={setContractData}
                standardRate={selectedService ? Number(selectedService.standard_rate) : undefined}
              />
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedServiceId}>
              {isSubmitting ? 'Creating...' : 'Create Contract'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
