'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { createContractorSchema, type CreateContractorInput } from '@/lib/validations/contractor';
import { updateContractor } from '@/app/actions/contractor-management';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { ContractorWithUtilization } from '@/types/contractor';

interface EditContractorModalProps {
  contractor: ContractorWithUtilization;
  trigger?: React.ReactNode;
}

export function EditContractorModal({ contractor, trigger }: EditContractorModalProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<CreateContractorInput>({
    resolver: zodResolver(createContractorSchema),
    defaultValues: {
      name: contractor.name,
      rate: contractor.rate != null ? Number(contractor.rate) : null,
      rate_type: contractor.rate_type,
      engagement_type: contractor.engagement_type,
      status: contractor.status,
    },
  });

  const onSubmit = async (data: CreateContractorInput) => {
    setIsSubmitting(true);
    try {
      await updateContractor(contractor.id, data);
      toast({ title: 'Success', description: 'Contractor updated successfully' });
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update contractor',
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
          <DialogTitle>Edit Contractor</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Contractor or vendor name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rate_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="-- Optional --" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="HOURLY">Hourly</SelectItem>
                      <SelectItem value="DAILY">Daily</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="VARIABLE">Variable</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate ($)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Optional"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="engagement_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Engagement Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="-- Optional --" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="FULL_TIME">Full-Time</SelectItem>
                      <SelectItem value="PART_TIME">Part-Time</SelectItem>
                      <SelectItem value="PROJECT">Project-Based</SelectItem>
                      <SelectItem value="OWNER">Owner</SelectItem>
                      <SelectItem value="AGENCY">Agency</SelectItem>
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
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Active" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update Contractor'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
