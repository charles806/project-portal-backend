import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl && !dbUrl.includes('connection_limit')) {
  dbUrl += dbUrl.includes('?') ? '&connection_limit=20' : '?connection_limit=20';
}
if (dbUrl && !dbUrl.includes('pool_timeout')) {
  dbUrl += '&pool_timeout=30';
}

const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
console.log(`[Database] Initializing Prisma with URL: ${maskedUrl}`);

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// prisma.$connect()
//   .then(() => console.log('[Database] Successfully connected to database'))
//   .catch((err) => console.error('[Database] Connection failed:', err));

// Keep-alive ping to prevent Neon free-tier from auto-suspending (suspends after ~5min inactivity)
if (process.env.NODE_ENV !== 'production') {
  setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      // Reconnect silently on failure
    }
  }, 4 * 60 * 1000); // every 4 minutes
}