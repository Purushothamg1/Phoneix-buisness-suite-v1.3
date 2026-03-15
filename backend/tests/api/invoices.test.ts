import request from 'supertest';
import app from '../../src/app';
import { cleanDb, createTestUser, generateToken, prisma } from '../setup';

let adminToken: string;
let customerId: string;
let productId: string;

beforeEach(async () => {
  await cleanDb();
  const admin = await createTestUser('ADMIN');
  adminToken = generateToken(admin.id, admin.role);

  const customer = await prisma.customer.create({ data: { name: 'Test Customer', phone: '1234567890' } });
  customerId = customer.id;

  const product = await prisma.product.create({
    data: { name: 'Test Product', sku: 'TEST-001', purchasePrice: 100, sellingPrice: 150, stockQty: 20, minStockLevel: 5 },
  });
  productId = product.id;

  await prisma.setting.createMany({
    data: [{ key: 'invoice_prefix', value: 'INV' }, { key: 'default_tax', value: '18' }],
  });
});

describe('POST /api/invoices', () => {
  it('creates invoice and reduces stock', async () => {
    const res = await request(app).post('/api/invoices').set('Authorization', `Bearer ${adminToken}`).send({
      customerId,
      items: [{ productId, description: 'Test Product', qty: 2, unitPrice: 150, tax: 18 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.number).toMatch(/^INV-/);
    expect(res.body.status).toBe('UNPAID');

    const product = await prisma.product.findUnique({ where: { id: productId } });
    expect(product?.stockQty).toBe(18); // 20 - 2
  });

  it('returns 400 for insufficient stock', async () => {
    const res = await request(app).post('/api/invoices').set('Authorization', `Bearer ${adminToken}`).send({
      customerId,
      items: [{ productId, description: 'Test Product', qty: 100, unitPrice: 150 }],
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/payments — auto status update', () => {
  it('marks invoice PAID when full amount received', async () => {
    const invRes = await request(app).post('/api/invoices').set('Authorization', `Bearer ${adminToken}`).send({
      customerId,
      items: [{ productId, description: 'Test', qty: 1, unitPrice: 150, tax: 0 }],
    });
    const invoiceId = invRes.body.id;
    const totalAmount = invRes.body.totalAmount;

    const payRes = await request(app).post('/api/payments').set('Authorization', `Bearer ${adminToken}`).send({
      invoiceId, amount: Number(totalAmount), method: 'CASH',
    });
    expect(payRes.status).toBe(201);

    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(inv?.status).toBe('PAID');
  });

  it('marks invoice PARTIAL on part payment', async () => {
    const invRes = await request(app).post('/api/invoices').set('Authorization', `Bearer ${adminToken}`).send({
      customerId,
      items: [{ productId, description: 'Test', qty: 1, unitPrice: 500, tax: 0 }],
    });
    const invoiceId = invRes.body.id;

    await request(app).post('/api/payments').set('Authorization', `Bearer ${adminToken}`).send({
      invoiceId, amount: 200, method: 'CASH',
    });

    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(inv?.status).toBe('PARTIAL');
  });
});

describe('POST /api/invoices/:id/cancel', () => {
  it('cancels invoice and restores stock', async () => {
    const invRes = await request(app).post('/api/invoices').set('Authorization', `Bearer ${adminToken}`).send({
      customerId,
      items: [{ productId, description: 'Test', qty: 3, unitPrice: 150, tax: 0 }],
    });
    const invoiceId = invRes.body.id;

    await request(app).post(`/api/invoices/${invoiceId}/cancel`).set('Authorization', `Bearer ${adminToken}`);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    expect(product?.stockQty).toBe(20); // restored
  });
});
