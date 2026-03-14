'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { createServiceSchema, type CreateServiceInput } from '@/lib/validations/service';
import { createService } from '@/app/actions/service-management';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';

type RateType = 'hourly' | 'monthly' | 'one_time';

export function AddServiceModal({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rateType, setRateType] = useState<RateType>('monthly');
  const [monthlyRate, setMonthlyRate] = useState<number>(0);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<CreateServiceInput>({
    resolver: zodResolver(createServiceSchema) as any,
    defaultValues: {
      name: '',
      description: '',
      standard_rate: 0,
      billing_type: 'recurring' as const,
      target_margin: 40,
      is_active: true,
    },
  });

  // Calculate hourly rate from monthly rate (160 hours/month standard)
  const calculateHourlyFromMonthly = (monthly: number): number => {
    return Number((monthly / 160).toFixed(2));
  };

  // Calculate monthly rate from hourly rate
  const calculateMonthlyFromHourly = (hourly: number): number => {
    return Number((hourly * 160).toFixed(2));
  };

  // Handle monthly rate input change
  const handleMonthlyRateChange = (value: string) => {
    const monthly = parseFloat(value) || 0;
    setMonthlyRate(monthly);
    const hourly = calculateHourlyFromMonthly(monthly);
    form.setValue('standard_rate', hourly);
  };

  // Handle hourly rate input change
  const handleHourlyRateChange = (value: string) => {
    const hourly = parseFloat(value) || 0;
    form.setValue('standard_rate', hourly);
    setMonthlyRate(calculateMonthlyFromHourly(hourly));
  };

  // Handle rate type change
  const handleRateTypeChange = (type: RateType) => {
    setRateType(type);
    form.setValue('billing_type', type === 'one_time' ? 'one_time' : 'recurring');
  };

  const onSubmit = async (data: CreateServiceInput) => {
    setIsSubmitting(true);
    try {
      await createService(data);
      toast({ title: 'Success', description: 'Service created successfully' });
      setOpen(false);
      form.reset();
      setMonthlyRate(0);
      setRateType('monthly');
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create service',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentHourlyRate = form.watch('standard_rate');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || <Button>Add Service</Button>}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Service</DialogTitle>
          <DialogDescription>
            Add a service that you provide to clients. Enter the rate your client pays you.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., BDR Services, Full Stack Development" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe what this service includes..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
              <div>
                <Label className="text-base font-semibold">Client Rate (What Client Pays You)</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter the rate your client pays you for this service
                </p>
              </div>

              <div className="space-y-3">
                <RadioGroup value={rateType} onValueChange={handleRateTypeChange} className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="monthly" id="monthly" />
                    <Label htmlFor="monthly" className="cursor-pointer">Monthly Rate</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="hourly" id="hourly" />
                    <Label htmlFor="hourly" className="cursor-pointer">Hourly Rate</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="one_time" id="one_time" />
                    <Label htmlFor="one_time" className="cursor-pointer">One-Time</Label>
                  </div>
                </RadioGroup>

                {rateType === 'monthly' ? (
                  <div className="space-y-2">
                    <Label>Monthly Rate (Client Pays You) *</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">$</span>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="8000"
                        value={monthlyRate || ''}
                        onChange={(e) => handleMonthlyRateChange(e.target.value)}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground">/month</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Converted to hourly: <strong>${currentHourlyRate.toFixed(2)}/hr</strong> (based on 160 hrs/month)
                    </p>
                  </div>
                ) : rateType === 'one_time' ? (
                  <div className="space-y-2">
                    <FormField
                      control={form.control}
                      name="standard_rate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Fee (One-Time) *</FormLabel>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">$</span>
                            <FormControl>
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="5000"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                className="flex-1"
                              />
                            </FormControl>
                          </div>
                          <FormDescription>
                            Total project fee charged to the client (not recurring)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <FormField
                      control={form.control}
                      name="standard_rate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hourly Rate (Client Pays You) *</FormLabel>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">$</span>
                            <FormControl>
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="50"
                                {...field}
                                onChange={(e) => handleHourlyRateChange(e.target.value)}
                                className="flex-1"
                              />
                            </FormControl>
                            <span className="text-sm text-muted-foreground">/hour</span>
                          </div>
                          <FormDescription>
                            Monthly equivalent: <strong>${monthlyRate.toFixed(2)}/month</strong> (based on 160 hrs/month)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            </div>

            <FormField
              control={form.control}
              name="target_margin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Profit Margin (%) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="40"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    Your desired profit margin for this service (e.g., 40% means 40% profit after costs)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Service'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
