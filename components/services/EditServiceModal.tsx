'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { createServiceSchema, type CreateServiceInput } from '@/lib/validations/service';
import { updateService } from '@/app/actions/service-management';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Service } from '@prisma/client';

interface EditServiceModalProps {
  service: Service;
  trigger?: React.ReactNode;
}

export function EditServiceModal({ service, trigger }: EditServiceModalProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<CreateServiceInput>({
    resolver: zodResolver(createServiceSchema) as any,
    defaultValues: {
      name: service.name,
      description: service.description || '',
      standard_rate: Number(service.standard_rate),
      billing_type: (service.billing_type as 'recurring' | 'one_time') || 'recurring',
      target_margin: Number(service.target_margin),
      is_active: service.is_active,
    },
  });

  const billingType = form.watch('billing_type');

  const onSubmit = async (data: CreateServiceInput) => {
    setIsSubmitting(true);
    try {
      await updateService(service.id, data);
      toast({ title: 'Success', description: 'Service updated successfully' });
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update service',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || <Button variant="outline">Edit</Button>}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Service</DialogTitle>
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
                    <Input placeholder="Full Stack Development" {...field} />
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
                    <Textarea placeholder="Service description..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="billing_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billing Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="recurring">Recurring (Hourly/Monthly)</SelectItem>
                      <SelectItem value="one_time">One-Time (Project Fee)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="standard_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{billingType === 'one_time' ? 'Project Fee ($) *' : 'Rate ($/hr) *'}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="target_margin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Margin (%) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0 cursor-pointer">Active</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update Service'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
