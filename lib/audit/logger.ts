import { prisma } from '@/lib/prisma'
import type { AuditActionType } from '@prisma/client'

/**
 * Input for creating an audit log entry
 */
export interface AuditLogInput {
  actorId: string // User who performed the action
  targetUserId?: string // User affected by the action (nullable for system actions)
  actionType: AuditActionType
  actionDetails: Record<string, any> // Before/after values, specific changes
  ipAddress?: string
}

/**
 * Create immutable audit log entry
 *
 * Logs admin actions for compliance and security auditing.
 * All user management operations (create, edit, delete, role changes)
 * should be logged.
 *
 * @param input - Audit log details
 *
 * @example
 * await createAuditLog({
 *   actorId: admin.userId,
 *   targetUserId: user.id,
 *   actionType: 'USER_CREATED',
 *   actionDetails: {
 *     email: user.email,
 *     role: user.role,
 *     invitedBy: admin.email
 *   },
 *   ipAddress: getIPAddress(request)
 * })
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actor_id: input.actorId,
      target_user_id: input.targetUserId,
      action_type: input.actionType,
      action_details: input.actionDetails,
      ip_address: input.ipAddress,
    },
  })
}

/**
 * Extract IP address from request headers
 *
 * Checks multiple headers in order of priority:
 * 1. x-forwarded-for (proxy/load balancer)
 * 2. x-real-ip (nginx)
 * 3. connection.remoteAddress (direct connection)
 *
 * @param request - Next.js Request object
 * @returns IP address string or undefined
 *
 * @example
 * export async function myAction(request: Request) {
 *   const ip = getIPAddress(request)
 *   await createAuditLog({ ...data, ipAddress: ip })
 * }
 */
export function getIPAddress(request: Request): string | undefined {
  // Check x-forwarded-for header (proxy/load balancer)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // Take first IP if multiple proxies
    return forwardedFor.split(',')[0].trim()
  }

  // Check x-real-ip header (nginx)
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }

  // No IP address found in headers
  return undefined
}
