import request from 'supertest';
import app from '../../src/app';
import { cleanDb, createTestUser, generateToken, prisma } from '../setup';

let adminToken: string;
let managerToken: string;
let staffToken: string;

beforeEach(async () => {
  await cleanDb();
  const admin = await createTestUser('ADMIN');
  const manager = await createTestUser('MANAGER');
  const staff = await createTestUser('STAFF');
  adminToken = generateToken(admin.id, admin.role);
  managerToken = generateToken(manager.id, manager.role);
  staffToken = generateToken(staff.id, staff.role);
});

const productPayload = {
  name: 'iPhone 15 Screen', sku: 'IPHONE15-SCR',
  purchasePrice: 2500, sellingPrice: 4000,
  stockQty: 10, minStockLevel: 3, category: 'Screens',
};

describe('POST /api/products — RBAC', () => {
  it('allows ADMIN to create product', async () => {
    const res = await request(app).post('/api/products').set('Authorization', `Bearer ${adminToken}`).send(productPayload);
    expect(res.status).toBe(201);
  });

  it('allows MANAGER to create product', async () => {
    const res = await request(app).post('/api/products').set('Authorization', `Bearer ${managerToken}`).send(productPayload);
    expect(res.status).toBe(201);
  });

  it('denies STAFF from creating product', async () => {
    const res = await request(app).post('/api/products').set('Authorization', `Bearer ${staffToken}`).send(productPayload);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/products/low-stock', () => {
  it('returns products at or below min stock level', async () => {
    await prisma.product.create({
      data: { name: 'Low Item', sku: 'LOW-001', purchasePrice: 100, sellingPrice: 200, stockQty: 2, minStockLevel: 5 },
    });
    await prisma.product.create({
      data: { name: 'OK Item', sku: 'OK-001', purchasePrice: 100, sellingPrice: 200, stockQty: 20, minStockLevel: 5 },
    });

    const res = await request(app).get('/api/products/low-stock').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some((p: any) => p.sku === 'LOW-001')).toBe(true);
    expect(res.body.some((p: any) => p.sku === 'OK-001')).toBe(false);
  });
});

describe('POST /api/products/:id/adjust-stock', () => {
  it('adjusts stock and records movement', async () => {
    const product = await prisma.product.create({
      data: { name: 'Adjustable', sku: 'ADJ-001', purchasePrice: 100, sellingPrice: 200, stockQty: 10, minStockLevel: 2 },
    });

    const res = await request(app).post(`/api/products/${product.id}/adjust-stock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 5, movementType: 'PURCHASE', note: 'Restock' });

    expect(res.status).toBe(200);
    expect(res.body.stockQty).toBe(15);

    const movement = await prisma.stockMovement.findFirst({ where: { productId: product.id } });
    expect(movement?.movementType).toBe('PURCHASE');
    expect(movement?.quantity).toBe(5);
  });

  it('prevents negative stock', async () => {
    const product = await prisma.product.create({
      data: { name: 'Small Stock', sku: 'SM-001', purchasePrice: 100, sellingPrice: 200, stockQty: 2, minStockLevel: 1 },
    });

    const res = await request(app).post(`/api/products/${product.id}/adjust-stock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: -10, movementType: 'ADJUSTMENT' });

    expect(res.status).toBe(400);
  });
});
