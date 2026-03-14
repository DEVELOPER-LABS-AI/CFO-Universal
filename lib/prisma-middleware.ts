import { Prisma } from '@prisma/client'

/**
 * Soft Delete Middleware
 *
 * Automatically handles soft deletes for Client, Service, and Contractor models:
 * - Converts hard deletes to soft deletes (sets deleted_at timestamp)
 * - Filters out soft-deleted records from queries automatically
 */
export const softDeleteMiddleware: Prisma.Middleware = async (params, next) => {
  const softDeleteModels = ['Client', 'Service', 'Contractor']

  if (params.model && softDeleteModels.includes(params.model)) {
    // Convert delete to update with deleted_at timestamp
    if (params.action === 'delete') {
      params.action = 'update'
      params.args.data = { deleted_at: new Date() }
    }

    // Convert deleteMany to updateMany with deleted_at timestamp
    if (params.action === 'deleteMany') {
      params.action = 'updateMany'
      if (params.args.data != undefined) {
        params.args.data.deleted_at = new Date()
      } else {
        params.args.data = { deleted_at: new Date() }
      }
    }

    // Exclude soft-deleted records from findUnique/findFirst
    if (params.action === 'findUnique' || params.action === 'findFirst') {
      params.action = 'findFirst'
      params.args.where = { ...params.args.where, deleted_at: null }
    }

    // Exclude soft-deleted records from findMany
    if (params.action === 'findMany') {
      if (params.args.where) {
        if (params.args.where.deleted_at === undefined) {
          params.args.where.deleted_at = null
        }
      } else {
        params.args.where = { deleted_at: null }
      }
    }

    // Update: only update non-deleted records
    if (params.action === 'update') {
      params.action = 'updateMany'
      params.args.where = { ...params.args.where, deleted_at: null }
    }

    // UpdateMany: only update non-deleted records
    if (params.action === 'updateMany') {
      if (params.args.where) {
        params.args.where.deleted_at = null
      } else {
        params.args.where = { deleted_at: null }
      }
    }
  }

  return next(params)
}
