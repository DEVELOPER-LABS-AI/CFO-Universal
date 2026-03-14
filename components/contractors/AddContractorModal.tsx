'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { createContractorSchema, type CreateContractorInput } from '@/lib/validations/contractor';
import { createContractor } from '@/app/actions/contractor-management';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface AddContractorModalProps {
  trigger?: React.ReactNode;
  /** Pre-fill the contractor name (e.g. from a merchant name). */
  defaultName?: string;
  /** Called after successful creation with the new contractor's id and name. */
  onCreated?: (contractor: { id: string; name: string }) => void;
}

export function AddContractorModal({ trigger, defaultName, onCreated }: AddContractorModalProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<CreateContractorInput>({
    resolver: zodResolver(createContractorSchema),
    defaultValues: {
      name: defaultName ?? '',
    },
  });

  // Sync name field when defaultName changes
  useEffect(() => {
    if (defaultName !== undefined) {
      form.setValue('name', defaultName);
    }
  }, [defaultName, form]);

  const onSubmit = async (data: CreateContractorInput) => {
    setIsSubmitting(true);
    try {
      const created = await createContractor(data);
      toast({ title: 'Success', description: 'Contractor created successfully' });
      setOpen(false);
      form.reset();
      onCreated?.({ id: created.id, name: created.name });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create contractor',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || <Button>Add Contractor</Button>}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Contractor</DialogTitle>
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Contractor'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
