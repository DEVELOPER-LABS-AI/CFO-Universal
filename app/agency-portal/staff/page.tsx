import { requireAgencyAdmin } from '@/lib/auth/helpers';
import {
  getAgencyStaff,
  getAgencyBonuses,
  getAgencyReimbursements,
} from '@/app/actions/agency-portal-actions';
import { StaffPageContent } from '@/components/agency-portal/StaffPageContent';

/**
 * Agency portal staff management page.
 * Lists all staff members and current-month bonuses for the agency.
 */
export default async function AgencyStaffPage() {
  await requireAgencyAdmin();

  const [staff, bonuses, reimbursements] = await Promise.all([
    getAgencyStaff(),
    getAgencyBonuses(), // no args = current month
    getAgencyReimbursements(), // no args = current month
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your agency staff members, rates, bonuses, and reimbursements.
        </p>
      </div>

      <StaffPageContent staff={staff} bonuses={bonuses} reimbursements={reimbursements} />
    </div>
  );
}
