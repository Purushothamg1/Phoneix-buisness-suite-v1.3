import { prisma } from '../../config/database';
import { NotFoundError, ConflictError } from '../../shared/errors/AppError';
import { getPaginationParams, buildPaginatedResult } from '../../shared/utils/pagination';

export const customerService = {
  async list(query: { page?: string; limit?: string; search?: string }) {
    const { page, limit, skip } = getPaginationParams(query);
    const where = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { phone: { contains: query.search } },
            { email: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.customer.count({ where }),
    ]);

    return buildPaginatedResult(data, total, { page, limit, skip });
  },

  async create(data: { name: string; phone: string; email?: string; address?: string; notes?: string }) {
    const existing = await prisma.customer.findFirst({ where: { phone: data.phone } });
    if (existing) throw new ConflictError('Customer with this phone already exists');
    return prisma.customer.create({ data });
  },

  async getById(id: string) {
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundError('Customer');
    return customer;
  },

  async update(id: string, data: { name: string; phone: string; email?: string; address?: string; notes?: string }) {
    await this.getById(id);
    const duplicate = await prisma.customer.findFirst({
      where: { phone: data.phone, NOT: { id } },
    });
    if (duplicate) throw new ConflictError('Another customer with this phone exists');
    return prisma.customer.update({ where: { id }, data });
  },

  async remove(id: string) {
    await this.getById(id);
    return prisma.customer.delete({ where: { id } });
  },

  async getHistory(id: string) {
    await this.getById(id);
    const [invoices, repairs, outstanding] = await Promise.all([
      prisma.invoice.findMany({
        where: { customerId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { items: true, payments: true },
      }),
      prisma.repairJob.findMany({
        where: { customerId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.invoice.aggregate({
        where: { customerId: id, status: { in: ['UNPAID', 'PARTIAL'] } },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      invoices,
      repairs,
      outstandingBalance: outstanding._sum.totalAmount || 0,
    };
  },
};
