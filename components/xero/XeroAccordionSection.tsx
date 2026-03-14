/**
 * XeroAccordionSection Component
 *
 * Wrapper component that organizes the Xero integration data into collapsible
 * accordion sections. Contains:
 * - Contacts: unmapped and all contact mappings (ContactsSection)
 * - Expenses: uncategorized and all Xero expenses (XeroExpensesSection)
 */

'use client';

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { ContactsSection } from './ContactsSection';
import { XeroExpensesSection } from './XeroExpensesSection';

export function XeroAccordionSection() {
  return (
    <Accordion type="multiple" className="bg-white rounded-lg border border-gray-200">
      <AccordionItem value="contacts">
        <AccordionTrigger className="px-6">
          <span className="text-lg font-semibold">Contacts</span>
        </AccordionTrigger>
        <AccordionContent className="px-6">
          <ContactsSection />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="expenses">
        <AccordionTrigger className="px-6">
          <span className="text-lg font-semibold">Expenses</span>
        </AccordionTrigger>
        <AccordionContent className="px-6">
          <XeroExpensesSection />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
