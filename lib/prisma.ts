import 'server-only'
import '@/lib/env'
import { PrismaClient, Prisma } from '@prisma/client'
import { softDeleteMiddleware } from './prisma-middleware'

export { Prisma }

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// Apply soft delete middleware
prisma.$use(softDeleteMiddleware)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
