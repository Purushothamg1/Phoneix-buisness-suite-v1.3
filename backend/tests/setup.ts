import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

export async function cleanDb() {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.repairPart.deleteMany(),
    prisma.repairJob.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.invoiceItem.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.stockMovement.deleteMany(),
    prisma.product.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.setting.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export async function createTestUser(role: 'ADMIN' | 'MANAGER' | 'STAFF' = 'ADMIN') {
  const password = await bcrypt.hash('Test@1234', 10);
  return prisma.user.create({
    data: { email: `${role.toLowerCase()}@test.com`, password, name: `Test ${role}`, role },
  });
}

export function generateToken(userId: string, role: string) {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'test_secret', { expiresIn: '1h' });
}

afterAll(async () => { await prisma.$disconnect(); });
