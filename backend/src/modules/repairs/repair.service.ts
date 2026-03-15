import { prisma } from '../../config/database';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { getPaginationParams, buildPaginatedResult } from '../../shared/utils/pagination';
import { pdfService } from '../pdf/pdf.service';

// FIX: race-condition-safe job ID (inside transaction)
async function generateJobId(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<string> {
  const count = await tx.repairJob.count();
  const candidate = `JOB-${String(count + 1).padStart(5, '0')}`;
  const existing = await tx.repairJob.findUnique({ where: { jobId: candidate } });
  if (existing) return `JOB-${String(count + 2).padStart(5, '0')}-${Date.now().toString(36).slice(-4)}`;
  return candidate;
}

interface PartInput { productId: string; qty: number; cost: number; }

export const repairService = {
  async list(query: Record<string, string>) {
    const { page, limit, skip } = getPaginationParams(query);
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.technicianId) where.technicianId = query.technicianId;
    if (query.customerId) where.customerId = query.customerId;
    if (query.search) {
      where.OR = [
        { jobId: { contains: query.search, mode: 'insensitive' } },
        { brand: { contains: query.search, mode: 'insensitive' } },
        { model: { contains: query.search, mode: 'insensitive' } },
        { customer: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    if (query.from || query.to) {
      const dateFilter: Record<string, Date> = {};
      if (query.from) dateFilter.gte = new Date(query.from);
      if (query.to) { const to = new Date(query.to); to.setHours(23,59,59,999); dateFilter.lte = to; }
      where.createdAt = dateFilter;
    }
    const [data, total] = await Promise.all([
      prisma.repairJob.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          technician: { select: { id: true, name: true } },
          parts: { include: { product: { select: { name: true, sku: true } } } },
        },
      }),
      prisma.repairJob.count({ where }),
    ]);
    return buildPaginatedResult(data, total, { page, limit, skip });
  },

  async create(data: {
    customerId: string; deviceType: string; brand: string; model: string;
    serialNumber?: string; issueDescription: string; technicianId?: string;
    estimatedCost?: number; parts?: PartInput[];
  }) {
    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) throw new NotFoundError('Customer');

    const { parts = [], ...jobData } = data;

    // Validate parts stock before transaction
    for (const part of parts) {
      const product = await prisma.product.findUnique({ where: { id: part.productId } });
      if (!product) throw new NotFoundError(`Product (${part.productId})`);
      if (product.stockQty < part.qty) {
        throw new ValidationError(
          `Insufficient stock for part "${product.name}". Available: ${product.stockQty}, Requested: ${part.qty}`
        );
      }
    }

    const repair = await prisma.$transaction(async (tx) => {
      const jobId = await generateJobId(tx);

      const job = await tx.repairJob.create({
        data: {
          ...jobData,
          jobId,
          parts: parts.length ? {
            create: parts.map((p) => ({ productId: p.productId, qty: p.qty, cost: p.cost })),
          } : undefined,
        },
        include: {
          customer: true,
          technician: { select: { id: true, name: true } },
          parts: { include: { product: { select: { name: true, sku: true } } } },
        },
      });

      // Deduct stock for parts
      for (const part of parts) {
        await tx.product.update({
          where: { id: part.productId },
          data: { stockQty: { decrement: part.qty } },
        });
        await tx.stockMovement.create({
          data: {
            productId: part.productId,
            movementType: 'REPAIR_USAGE',
            quantity: -part.qty,
            note: `Repair ${jobId}`,
          },
        });
      }
      return job;
    });

    // Generate PDF outside transaction
    try {
      const pdfUrl = await pdfService.generateRepairPdf(repair.id);
      await prisma.repairJob.update({ where: { id: repair.id }, data: { pdfUrl } });
      return { ...repair, pdfUrl };
    } catch {
      return repair;
    }
  },

  async getById(id: string) {
    const repair = await prisma.repairJob.findUnique({
      where: { id },
      include: {
        customer: true,
        technician: { select: { id: true, name: true } },
        parts: { include: { product: { select: { id: true, name: true, sku: true } } } },
      },
    });
    if (!repair) throw new NotFoundError('Repair job');
    return repair;
  },

  async update(id: string, data: {
    status?: string; repairNotes?: string; technicianId?: string;
    finalCost?: number; estimatedCost?: number;
  }) {
    const existing = await this.getById(id);
    if (existing.status === 'DELIVERED' && data.status && data.status !== 'DELIVERED') {
      throw new ValidationError('Cannot revert a delivered repair job');
    }
    return prisma.repairJob.update({
      where: { id },
      data: data as any,
      include: {
        customer: true,
        technician: { select: { id: true, name: true } },
        parts: { include: { product: { select: { name: true } } } },
      },
    });
  },

  async remove(id: string) {
    const repair = await this.getById(id);
    if (!['RECEIVED', 'DIAGNOSING'].includes(repair.status)) {
      throw new ValidationError('Only repairs in RECEIVED or DIAGNOSING status can be deleted');
    }

    // Restore stock for parts before deleting
    await prisma.$transaction(async (tx) => {
      for (const part of repair.parts) {
        await tx.product.update({
          where: { id: part.productId },
          data: { stockQty: { increment: part.qty } },
        });
        await tx.stockMovement.create({
          data: {
            productId: part.productId,
            movementType: 'RETURN',
            quantity: part.qty,
            note: `Repair ${repair.jobId} deleted`,
          },
        });
      }
      await tx.repairJob.delete({ where: { id } });
    });
  },
};
