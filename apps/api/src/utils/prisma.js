import { PrismaClient } from '@prisma/client';

export const prisma = globalThis.__zetapanelPrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__zetapanelPrisma = prisma;
}
