import { PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma';
import dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.env.DATABASE_URL || '';
const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
console.log(`[Database] Initializing Prisma with URL: ${maskedUrl}`);

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

prisma.$connect()
  .then(() => console.log('[Database] Successfully connected to database'))
  .catch((err) => console.error('[Database] Connection failed:', err));

export default prisma;