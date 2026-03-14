/**
 * MercuryAccordionSection Component
 *
 * Top-level accordion wrapper that embeds MerchantsSection and ExpensesSection.
 * Designed to be rendered inside the Mercury integration dashboard page.
 * Displays badge counts for unmapped merchants and uncategorized expenses.
 */

'use client';

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { MerchantsSection } from './MerchantsSection';
import { ExpensesSection } from './ExpensesSection';

interface MercuryAccordionSectionProps {
  /** The current organization identifier. */
  organizationId: string;
  /** Number of merchants that have not yet been mapped. */
  unmappedMerchantsCount: number;
  /** Number of expenses that still need categorization. */
  uncategorizedExpensesCount: number;
}

/**
 * Renders an accordion with two collapsible sections:
 * 1. Merchants -- merchant mapping UI with unmapped count badge
 * 2. Expenses  -- expense categorization UI with uncategorized count badge
 *
 * @param props.organizationId - Passed through to child section components.
 * @param props.unmappedMerchantsCount - Shown as a red badge on the Merchants trigger.
 * @param props.uncategorizedExpensesCount - Shown as a red badge on the Expenses trigger.
 */
export function MercuryAccordionSection({
  organizationId,
  unmappedMerchantsCount,
  uncategorizedExpensesCount,
}: MercuryAccordionSectionProps) {
  return (
    <Accordion type="multiple" className="bg-white rounded-lg border border-gray-200">
      <AccordionItem value="merchants">
        <AccordionTrigger className="px-6">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">Vendor Mapping</span>
            {unmappedMerchantsCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                {unmappedMerchantsCount} unmapped
              </span>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6">
          <MerchantsSection organizationId={organizationId} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="expenses">
        <AccordionTrigger className="px-6">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">Expenses</span>
            {uncategorizedExpensesCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                {uncategorizedExpensesCount} uncategorized
              </span>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6">
          <ExpensesSection organizationId={organizationId} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
