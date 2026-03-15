import { MovementType } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError, ConflictError, ValidationError } from '../../shared/errors/AppError';
import { getPaginationParams, buildPaginatedResult } from '../../shared/utils/pagination';

export interface ProductCreateInput {
  name: string; sku: string; barcode?: string | null; category?: string | null;
  purchasePrice: number; sellingPrice: number; stockQty?: number; minStockLevel?: number;
}

export const productService = {
  async list(query: Record<string, string>) {
    const { page, limit, skip } = getPaginationParams(query);
    const where: Record<string, unknown> = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { barcode: { contains: query.search } },
      ];
    }
    if (query.category) where.category = { equals: query.category, mode: 'insensitive' };
    const [data, total] = await Promise.all([
      prisma.product.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      prisma.product.count({ where }),
    ]);
    return buildPaginatedResult(data, total, { page, limit, skip });
  },

  // FIX: prisma.product.fields.minStockLevel is NOT valid Prisma API — use raw SQL
  async lowStock() {
    return prisma.$queryRaw<Array<{
      id: string; name: string; sku: string; category: string | null;
      stockQty: number; minStockLevel: number; sellingPrice: number;
    }>>`
      SELECT id, name, sku, category, "stockQty", "minStockLevel", "sellingPrice"
      FROM "Product"
      WHERE "stockQty" <= "minStockLevel"
      ORDER BY "stockQty" ASC
    `;
  },

  async categories() {
    const cats = await prisma.product.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return cats.map((c) => c.category).filter(Boolean);
  },

  async create(data: ProductCreateInput) {
    const existingSku = await prisma.product.findUnique({ where: { sku: data.sku } });
    if (existingSku) throw new ConflictError('Product with this SKU already exists');
    if (data.barcode) {
      const existingBarcode = await prisma.product.findUnique({ where: { barcode: data.barcode } });
      if (existingBarcode) throw new ConflictError('Product with this barcode already exists');
    }
    return prisma.product.create({ data });
  },

  async getById(id: string) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError('Product');
    return product;
  },

  async update(id: string, data: ProductCreateInput) {
    await this.getById(id);
    const dupSku = await prisma.product.findFirst({ where: { sku: data.sku, NOT: { id } } });
    if (dupSku) throw new ConflictError('Another product with this SKU exists');
    if (data.barcode) {
      const dupBarcode = await prisma.product.findFirst({ where: { barcode: data.barcode, NOT: { id } } });
      if (dupBarcode) throw new ConflictError('Another product with this barcode exists');
    }
    return prisma.product.update({ where: { id }, data });
  },

  async remove(id: string) {
    await this.getById(id);
    return prisma.product.delete({ where: { id } });
  },

  async adjustStock(id: string, quantity: number, movementType: MovementType, note?: string) {
    const product = await this.getById(id);
    const newQty = product.stockQty + quantity;
    if (newQty < 0) throw new ValidationError(
      `Stock adjustment would result in negative stock. Current: ${product.stockQty}, Requested change: ${quantity}`
    );

    return prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: { stockQty: newQty },
      });
      await tx.stockMovement.create({
        data: { productId: id, movementType, quantity, note },
      });
      return updated;
    });
  },

  async getMovements(id: string, query: Record<string, string>) {
    await this.getById(id);
    const { page, limit, skip } = getPaginationParams(query);
    const [data, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where: { productId: id },
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.stockMovement.count({ where: { productId: id } }),
    ]);
    return buildPaginatedResult(data, total, { page, limit, skip });
  },
};
