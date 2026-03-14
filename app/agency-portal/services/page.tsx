import { requireAgencyAdmin } from '@/lib/auth/helpers'
import { getAgencyServices } from '@/app/actions/agency-portal-actions'
import { ServicesPageContent } from '@/components/agency-portal/ServicesPageContent'

/**
 * Agency portal services management page.
 * Lists all services the agency provides with add/edit/remove capabilities.
 */
export default async function AgencyServicesPage() {
  await requireAgencyAdmin()
  const services = await getAgencyServices()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Services</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage the services your agency provides
        </p>
      </div>

      <ServicesPageContent services={services} />
    </div>
  )
}
