'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { createClientSchema, type CreateClientInput } from '@/lib/validations/client';
import { createClient } from '@/app/actions/client-management';
import { createService } from '@/app/actions/service-management';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Service } from '@prisma/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, X } from 'lucide-react';

interface AddClientModalProps {
  services: Service[];
  trigger?: React.ReactNode;
}

type RateType = 'hourly' | 'monthly' | 'one_time';

export function AddClientModal({ services, trigger }: AddClientModalProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localServices, setLocalServices] = useState<Service[]>(services);
  const [showAddService, setShowAddService] = useState(false);
  const [isCreatingService, setIsCreatingService] = useState(false);
  const [rateType, setRateType] = useState<RateType>('monthly');
  const [monthlyRate, setMonthlyRate] = useState<number>(0);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDescription, setNewServiceDescription] = useState('');
  const [newServiceMargin, setNewServiceMargin] = useState<number>(40);
  const [newServiceHourlyRate, setNewServiceHourlyRate] = useState<number>(0);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema) as any,
    defaultValues: {
      name: '',
      relationship_type: 'RETAINER',
      status: 'ACTIVE',
      custom_margin_target: undefined,
      start_date: new Date(),
      service_ids: [],
      is_internal: false,
    },
  });

  const isInternal = form.watch('is_internal');

  // Keep localServices in sync when prop changes (e.g., modal reopened)
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setLocalServices(services);
    }
  };

  const resetServiceForm = () => {
    setNewServiceName('');
    setNewServiceDescription('');
    setNewServiceMargin(40);
    setNewServiceHourlyRate(0);
    setMonthlyRate(0);
    setRateType('monthly');
    setShowAddService(false);
  };

  const handleMonthlyRateChange = (value: string) => {
    const monthly = parseFloat(value) || 0;
    setMonthlyRate(monthly);
    setNewServiceHourlyRate(Number((monthly / 160).toFixed(2)));
  };

  const handleHourlyRateChange = (value: string) => {
    const hourly = parseFloat(value) || 0;
    setNewServiceHourlyRate(hourly);
    setMonthlyRate(Number((hourly * 160).toFixed(2)));
  };

  const handleCreateService = async () => {
    if (!newServiceName.trim()) {
      toast({ title: 'Error', description: 'Service name is required', variant: 'destructive' });
      return;
    }
    if (!newServiceDescription.trim()) {
      toast({ title: 'Error', description: 'Description is required', variant: 'destructive' });
      return;
    }
    const rateValue = rateType === 'one_time' ? newServiceHourlyRate : newServiceHourlyRate;
    if (rateValue <= 0) {
      toast({ title: 'Error', description: 'Rate must be greater than 0', variant: 'destructive' });
      return;
    }

    setIsCreatingService(true);
    try {
      const newService = await createService({
        name: newServiceName.trim(),
        description: newServiceDescription.trim(),
        standard_rate: newServiceHourlyRate,
        billing_type: rateType === 'one_time' ? 'one_time' : 'recurring',
        target_margin: newServiceMargin,
        is_active: true,
      });

      // Add to local list and auto-select
      setLocalServices((prev) => [...prev, newService as Service]);
      const currentIds = form.getValues('service_ids') || [];
      form.setValue('service_ids', [...currentIds, newService.id]);

      toast({ title: 'Success', description: `Service "${newService.name}" created and selected` });
      resetServiceForm();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create service',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingService(false);
    }
  };

  const onSubmit = async (data: CreateClientInput) => {
    setIsSubmitting(true);
    try {
      await createClient(data);
      toast({ title: 'Success', description: 'Client created successfully' });
      setOpen(false);
      form.reset();
      resetServiceForm();
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create client',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || <Button>Add Client</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
          <DialogDescription>Create a new client and assign services</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Corp" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="relationship_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Relationship Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="RETAINER">Retainer</SelectItem>
                      <SelectItem value="PROJECT_BASED">Project-Based</SelectItem>
                      <SelectItem value="HOURLY">Hourly</SelectItem>
                      <SelectItem value="VALUE_BASED">Value-Based</SelectItem>
                      <SelectItem value="CUSTOM">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="custom_margin_target"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custom Margin Target (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="45.00"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormDescription>Leave empty to use service-level target</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date *</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ''}
                      onChange={(e) => field.onChange(new Date(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_internal"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value === true}
                      onCheckedChange={(checked) => {
                        const val = checked === true;
                        field.onChange(val);
                        if (val) {
                          form.setValue('service_ids', []);
                        }
                      }}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Internal Project</FormLabel>
                    <FormDescription>
                      Mark as internal if this is your own company (not a revenue-generating client)
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {!isInternal && (
              <FormField
                control={form.control}
                name="service_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Services * (select at least one)</FormLabel>
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                      {localServices.filter(s => s.is_active).map((service) => (
                        <div key={service.id} className="flex items-center space-x-2">
                          <Checkbox
                            checked={field.value?.includes(service.id)}
                            onCheckedChange={(checked) => {
                              const current = field.value || [];
                              if (checked) {
                                field.onChange([...current, service.id]);
                              } else {
                                field.onChange(current.filter((id) => id !== service.id));
                              }
                            }}
                          />
                          <label className="text-sm cursor-pointer flex-1">
                            {service.name} ({service.billing_type === 'one_time'
                              ? `$${Number(service.standard_rate).toLocaleString()} one-time`
                              : `$${(Number(service.standard_rate) * 160).toFixed(0)}/mo \u00B7 $${Number(service.standard_rate).toFixed(2)}/hr`
                            })
                          </label>
                        </div>
                      ))}
                    </div>

                    {/* Inline Add Service */}
                    {!showAddService ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => setShowAddService(true)}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Add New Service
                      </Button>
                    ) : (
                      <div className="mt-3 border rounded-lg p-4 bg-gray-50 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold">New Service</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={resetServiceForm}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div>
                          <Label className="text-xs">Service Name *</Label>
                          <Input
                            placeholder="e.g., BDR Services"
                            value={newServiceName}
                            onChange={(e) => setNewServiceName(e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-xs">Description *</Label>
                          <Textarea
                            placeholder="Describe what this service includes..."
                            value={newServiceDescription}
                            onChange={(e) => setNewServiceDescription(e.target.value)}
                            className="mt-1"
                            rows={2}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Client Rate</Label>
                          <RadioGroup
                            value={rateType}
                            onValueChange={(v) => setRateType(v as RateType)}
                            className="flex gap-4"
                          >
                            <div className="flex items-center space-x-1">
                              <RadioGroupItem value="monthly" id="new-svc-monthly" />
                              <Label htmlFor="new-svc-monthly" className="text-xs cursor-pointer">Monthly</Label>
                            </div>
                            <div className="flex items-center space-x-1">
                              <RadioGroupItem value="hourly" id="new-svc-hourly" />
                              <Label htmlFor="new-svc-hourly" className="text-xs cursor-pointer">Hourly</Label>
                            </div>
                            <div className="flex items-center space-x-1">
                              <RadioGroupItem value="one_time" id="new-svc-one-time" />
                              <Label htmlFor="new-svc-one-time" className="text-xs cursor-pointer">One-Time</Label>
                            </div>
                          </RadioGroup>

                          {rateType === 'monthly' ? (
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">$</span>
                                <Input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  placeholder="8000"
                                  value={monthlyRate || ''}
                                  onChange={(e) => handleMonthlyRateChange(e.target.value)}
                                  className="flex-1"
                                />
                                <span className="text-xs text-muted-foreground">/mo</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Hourly: ${newServiceHourlyRate.toFixed(2)}/hr (160 hrs/mo)
                              </p>
                            </div>
                          ) : rateType === 'one_time' ? (
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">$</span>
                                <Input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  placeholder="5000"
                                  value={newServiceHourlyRate || ''}
                                  onChange={(e) => setNewServiceHourlyRate(parseFloat(e.target.value) || 0)}
                                  className="flex-1"
                                />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Total project fee (not recurring)
                              </p>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">$</span>
                                <Input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  placeholder="50"
                                  value={newServiceHourlyRate || ''}
                                  onChange={(e) => handleHourlyRateChange(e.target.value)}
                                  className="flex-1"
                                />
                                <span className="text-xs text-muted-foreground">/hr</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Monthly: ${monthlyRate.toFixed(2)}/mo (160 hrs/mo)
                              </p>
                            </div>
                          )}
                        </div>

                        <div>
                          <Label className="text-xs">Target Margin (%) *</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            placeholder="40"
                            value={newServiceMargin}
                            onChange={(e) => setNewServiceMargin(parseFloat(e.target.value) || 0)}
                            className="mt-1"
                          />
                        </div>

                        <div className="flex gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleCreateService}
                            disabled={isCreatingService}
                          >
                            {isCreatingService ? 'Creating...' : 'Save Service'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={resetServiceForm}
                            disabled={isCreatingService}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Client'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
