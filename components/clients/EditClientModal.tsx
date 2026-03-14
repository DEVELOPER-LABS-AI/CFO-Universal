'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { createClientSchema, type CreateClientInput } from '@/lib/validations/client';
import { updateClient } from '@/app/actions/client-management';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Service } from '@prisma/client';
import { Checkbox } from '@/components/ui/checkbox';
import type { ClientWithServices } from '@/types/client';

interface EditClientModalProps {
  client: ClientWithServices;
  services: Service[];
  trigger?: React.ReactNode;
}

export function EditClientModal({ client, services, trigger }: EditClientModalProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema) as any,
    defaultValues: {
      name: client.name,
      relationship_type: client.relationship_type,
      status: client.status,
      custom_margin_target: client.custom_margin_target ? Number(client.custom_margin_target) : undefined,
      start_date: new Date(client.start_date),
      churn_date: client.churn_date ? new Date(client.churn_date) : null,
      service_ids: client.client_services.map((cs) => cs.service_id),
      is_internal: client.is_internal ?? false,
    },
  });

  const isInternal = form.watch('is_internal');

  const onSubmit = async (data: CreateClientInput) => {
    setIsSubmitting(true);
    try {
      await updateClient(client.id, data);
      toast({ title: 'Success', description: 'Client updated successfully' });
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update client',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Edit</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
          <DialogDescription>Update client information and services</DialogDescription>
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
                  <Select onValueChange={field.onChange} value={field.value}>
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
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                      <SelectItem value="CHURNED">Churned</SelectItem>
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
              name="churn_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Churn Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ''}
                      onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                    />
                  </FormControl>
                  <FormDescription>Set when client has churned</FormDescription>
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
                      {services.filter(s => s.is_active).map((service) => (
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
                            {service.name} (${Number(service.standard_rate).toFixed(2)})
                          </label>
                        </div>
                      ))}
                    </div>
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
                {isSubmitting ? 'Updating...' : 'Update Client'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
