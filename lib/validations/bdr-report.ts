import { z } from 'zod';

/**
 * Schema for saving a BDR monthly report (create or update draft).
 */
export const saveBDRReportSchema = z.object({
  month: z.number().int().min(1, 'Month must be between 1 and 12').max(12, 'Month must be between 1 and 12'),
  year: z.number().int().min(2000, 'Year must be 2000 or later').max(2100, 'Year must be before 2100'),
  meetings_booked: z.number().int().min(0, 'Meetings booked must be 0 or more'),
  meetings_showed: z.number().int().min(0, 'Meetings showed must be 0 or more'),
  notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional().nullable(),
});

/**
 * Schema for submitting a BDR report (transitions to SUBMITTED).
 */
export const submitBDRReportSchema = z.object({
  report_id: z.string().uuid('Invalid report ID'),
});

/**
 * Schema for getting a BDR monthly report by month/year.
 */
export const getBDRReportSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

export type SaveBDRReportInput = z.infer<typeof saveBDRReportSchema>;
export type SubmitBDRReportInput = z.infer<typeof submitBDRReportSchema>;
export type GetBDRReportInput = z.infer<typeof getBDRReportSchema>;
