import request from 'supertest';
import app from '../../src/app';
import { cleanDb, createTestUser, generateToken, prisma } from '../setup';

beforeEach(cleanDb);

async function makeProduct(sku = 'TEST-001', stock = 10) {
  return prisma.product.create({
    data: {
      name: 'Test Product',
      sku,
      purchasePrice: 100,
      sellingPrice: 150,
      stockQty: stock,
      minStockLevel: 5,
    },
  });
}

describe('Stock Adjustment — POST /api/products/:id/adjust-stock', () => {
  it('increases stock and records movement', async () => {
    const user = await createTestUser('MANAGER');
    const token = generateToken(user.id, 'MANAGER');
    const product = await makeProduct();

    const res = await request(app)
      .post(`/api/products/${product.id}/adjust-stock`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 15, movementType: 'PURCHASE', note: 'Restocked' });

    expect(res.status).toBe(200);
    expect(res.body.stockQty).toBe(25);

    const movement = await prisma.stockMovement.findFirst({ where: { productId: product.id } });
    expect(movement?.movementType).toBe('PURCHASE');
    expect(movement?.quantity).toBe(15);
  });

  it('rejects adjustment that would result in negative stock', async () => {
    const user = await createTestUser('MANAGER');
    const token = generateToken(user.id, 'MANAGER');
    const product = await makeProduct();

    const res = await request(app)
      .post(`/api/products/${product.id}/adjust-stock`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: -50, movementType: 'ADJUSTMENT' });

    expect(res.status).toBe(400);
  });

  it('denies STAFF from adjusting stock', async () => {
    const user = await createTestUser('STAFF');
    const token = generateToken(user.id, 'STAFF');
    const product = await makeProduct();

    const res = await request(app)
      .post(`/api/products/${product.id}/adjust-stock`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 10, movementType: 'PURCHASE' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/products/low-stock', () => {
  it('returns products at or below minStockLevel', async () => {
    const user = await createTestUser('ADMIN');
    const token = generateToken(user.id, 'ADMIN');

    await prisma.product.createMany({
      data: [
        { name: 'Low Item', sku: 'LOW-001', purchasePrice: 10, sellingPrice: 20, stockQty: 2, minStockLevel: 5 },
        { name: 'OK Item', sku: 'OK-001', purchasePrice: 10, sellingPrice: 20, stockQty: 50, minStockLevel: 5 },
        { name: 'Zero Item', sku: 'ZERO-001', purchasePrice: 10, sellingPrice: 20, stockQty: 0, minStockLevel: 5 },
      ],
    });

    const res = await request(app).get('/api/products/low-stock').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const skus = res.body.map((p: any) => p.sku);
    expect(skus).toContain('LOW-001');
    expect(skus).toContain('ZERO-001');
    expect(skus).not.toContain('OK-001');
  });
});

describe('Duplicate SKU / barcode', () => {
  it('rejects duplicate SKU on create', async () => {
    const user = await createTestUser('ADMIN');
    const token = generateToken(user.id, 'ADMIN');
    await makeProduct('DUP-001');

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Another', sku: 'DUP-001', purchasePrice: 10, sellingPrice: 20 });

    expect(res.status).toBe(409);
  });
});

describe('GET /api/products/:id/movements', () => {
  it('returns paginated stock movements', async () => {
    const user = await createTestUser('ADMIN');
    const token = generateToken(user.id, 'ADMIN');
    const product = await makeProduct();

    await prisma.stockMovement.createMany({
      data: [
        { productId: product.id, movementType: 'PURCHASE', quantity: 10 },
        { productId: product.id, movementType: 'SALE', quantity: -2 },
      ],
    });

    const res = await request(app)
      .get(`/api/products/${product.id}/movements`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
  });
});
