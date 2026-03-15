import request from 'supertest';
import app from '../../src/app';
import { cleanDb, createTestUser, generateToken, prisma } from '../setup';

beforeEach(cleanDb);

async function setup() {
  const user = await createTestUser('ADMIN');
  const token = generateToken(user.id, 'ADMIN');

  await prisma.setting.createMany({
    data: [
      { key: 'invoice_prefix', value: 'INV' },
      { key: 'default_tax', value: '18' },
    ],
  });

  const customer = await prisma.customer.create({ data: { name: 'Invoice Customer', phone: '9000000099' } });
  const product = await prisma.product.create({
    data: { name: 'Laptop', sku: 'LAP-001', purchasePrice: 30000, sellingPrice: 45000, stockQty: 10 },
  });

  return { token, customerId: customer.id, productId: product.id };
}

describe('Invoice creation — stock deduction', () => {
  it('reduces stock on invoice creation', async () => {
    const { token, customerId, productId } = await setup();

    await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        items: [{ productId, description: 'Laptop Sale', qty: 3, unitPrice: 45000, tax: 18 }],
      });

    const product = await prisma.product.findUnique({ where: { id: productId } });
    expect(product?.stockQty).toBe(7); // 10 - 3
  });

  it('records SALE stock movement', async () => {
    const { token, customerId, productId } = await setup();

    await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        items: [{ productId, description: 'Laptop', qty: 2, unitPrice: 45000 }],
      });

    const movement = await prisma.stockMovement.findFirst({ where: { productId } });
    expect(movement?.movementType).toBe('SALE');
    expect(movement?.quantity).toBe(-2);
  });

  it('rejects when stock is insufficient', async () => {
    const { token, customerId, productId } = await setup();

    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        items: [{ productId, description: 'Laptop', qty: 999, unitPrice: 45000 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insufficient stock/i);
  });

  it('calculates total, tax, and discount correctly', async () => {
    const { token, customerId, productId } = await setup();

    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        discount: 500,
        items: [{ productId, description: 'Laptop', qty: 1, unitPrice: 1000, tax: 18 }],
      });

    expect(res.status).toBe(201);
    const inv = res.body;
    // subtotal=1000, tax=180, discount=500 → total=680
    expect(Number(inv.taxAmount)).toBeCloseTo(180);
    expect(Number(inv.totalAmount)).toBeCloseTo(680);
  });
});

describe('Invoice cancel — stock restore', () => {
  it('restores stock and records RETURN movement on cancel', async () => {
    const { token, customerId, productId } = await setup();

    const createRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        items: [{ productId, description: 'Laptop', qty: 2, unitPrice: 45000 }],
      });

    const invoiceId = createRes.body.id;

    await request(app)
      .post(`/api/invoices/${invoiceId}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    expect(product?.stockQty).toBe(10); // restored to original

    const returnMovement = await prisma.stockMovement.findFirst({
      where: { productId, movementType: 'RETURN' },
    });
    expect(returnMovement).toBeTruthy();
  });

  it('cannot cancel an already-cancelled invoice', async () => {
    const { token, customerId, productId } = await setup();

    const createRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId, items: [{ productId, description: 'Laptop', qty: 1, unitPrice: 45000 }] });

    const invoiceId = createRes.body.id;
    await request(app).post(`/api/invoices/${invoiceId}/cancel`).set('Authorization', `Bearer ${token}`);
    const res = await request(app).post(`/api/invoices/${invoiceId}/cancel`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe('Invoice listing and filtering', () => {
  it('filters by status', async () => {
    const { token, customerId, productId } = await setup();

    // Create two invoices
    await request(app).post('/api/invoices').set('Authorization', `Bearer ${token}`)
      .send({ customerId, items: [{ productId, description: 'A', qty: 1, unitPrice: 100 }] });
    const r2 = await request(app).post('/api/invoices').set('Authorization', `Bearer ${token}`)
      .send({ customerId, items: [{ productId, description: 'B', qty: 1, unitPrice: 100 }] });

    // Pay the second one
    await request(app).post('/api/payments').set('Authorization', `Bearer ${token}`)
      .send({ invoiceId: r2.body.id, amount: 999999, method: 'CASH' });

    const res = await request(app).get('/api/invoices?status=PAID').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((i: any) => i.status === 'PAID')).toBe(true);
  });
});
