import { requireContractor } from '@/lib/auth/helpers'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/helpers'
import { DollarSign, CheckCircle, Clock, AlertCircle } from 'lucide-react'

const monthNames = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; bgColor: string }> = {
  COMPLETED: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50' },
  PENDING: { icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  PROCESSING: { icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  FAILED: { icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-50' },
}

/**
 * Contractor portal payment history page.
 * Shows all payments across invoices with status and amounts.
 */
export default async function PaymentsPage() {
  const user = await requireContractor()

  const payments = await prisma.contractorPayment.findMany({
    where: {
      invoice: {
        contractor_id: user.contractorId,
      },
    },
    include: {
      invoice: {
        select: {
          month: true,
          year: true,
          total_amount: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
  })

  // Aggregate totals
  const totalPaid = payments
    .filter((p) => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const totalPending = payments
    .filter((p) => p.status === 'PENDING' || p.status === 'PROCESSING')
    .reduce((sum, p) => sum + Number(p.amount), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
        <p className="text-sm text-gray-500 mt-1">Track all your contractor payments</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Received</p>
          <p className="text-2xl font-bold text-green-600">
            ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">
            ${totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Payments</p>
          <p className="text-2xl font-bold text-gray-900">{payments.length}</p>
        </div>
      </div>

      {/* Payment list */}
      {payments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <DollarSign className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No payments yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Payments will appear here once your invoices are approved and paid.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((payment) => {
                const config = statusConfig[payment.status] ?? statusConfig.PENDING
                const StatusIcon = config.icon

                return (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {monthNames[payment.invoice.month]} {payment.invoice.year}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      ${Number(payment.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {payment.payment_method?.replace('_', ' ') ?? '--'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color} ${config.bgColor}`}>
                        <StatusIcon className="h-3 w-3" />
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {payment.completed_at
                        ? new Date(payment.completed_at).toLocaleDateString()
                        : new Date(payment.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
