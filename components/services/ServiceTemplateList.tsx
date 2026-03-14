'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Briefcase } from 'lucide-react';
import type { Service } from '@prisma/client';

interface ServiceTemplateListProps {
  services: Service[];
  onSelectService?: (service: Service) => void;
}

export function ServiceTemplateList({ services, onSelectService }: ServiceTemplateListProps) {
  if (services.length === 0) {
    return (
      <EmptyState
        icon={<Briefcase className="h-12 w-12" />}
        title="No services found"
        description="Create service templates to assign to clients."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {services.map((service) => (
        <Card
          key={service.id}
          className={onSelectService ? 'cursor-pointer hover:border-primary transition-colors' : ''}
          onClick={() => onSelectService?.(service)}
        >
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg">{service.name}</CardTitle>
              {service.is_active ? (
                <Badge variant="default">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
            {service.description && (
              <CardDescription className="line-clamp-2">{service.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {service.billing_type === 'one_time' ? 'Project Fee' : 'Standard Rate'}
              </span>
              <span className="font-semibold">
                ${Number(service.standard_rate).toFixed(2)}
                {service.billing_type === 'one_time' ? '' : '/hr'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Target Margin</span>
              <span className="font-semibold">{Number(service.target_margin)}%</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
