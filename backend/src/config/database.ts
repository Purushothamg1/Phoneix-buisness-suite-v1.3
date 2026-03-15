import { PrismaClient } from '@prisma/client';
import { logger } from '../shared/utils/logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

prisma.$on('beforeExit' as any, async () => {
  logger.info('Prisma client disconnecting...');
});
