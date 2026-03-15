import request from 'supertest';
import app from '../../src/app';
import { cleanDb, createTestUser, generateToken, prisma } from '../setup';

beforeEach(cleanDb);

let adminToken: string;
let customerId: string;
let invoiceId: string;

async function bootstrap() {
  const user = await createTestUser('ADMIN');
  adminToken = generateToken(user.id, 'ADMIN');

  const customer = await prisma.customer.create({ data: { name: 'Pay Customer', phone: '9000000001' } });
  customerId = customer.id;

  const product = await prisma.product.create({
    data: { name: 'Widget', sku: 'WG-001', purchasePrice: 50, sellingPrice: 100, stockQty: 20 },
  });

  // Create invoice directly via Prisma to keep tests independent from invoice service
  const invoice = await prisma.invoice.create({
    data: {
      number: 'INV-00001',
      customerId,
      taxAmount: 18,
      discount: 0,
      totalAmount: 118,
      status: 'UNPAID',
      items: {
        create: [{ description: 'Widget', qty: 1, unitPrice: 100, tax: 18, total: 118, productId: product.id }],
      },
    },
  });
  invoiceId = invoice.id;
}

describe('POST /api/payments', () => {
  it('records a partial payment and updates status', async () => {
    await bootstrap();
    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ invoiceId, amount: 50, method: 'CASH' });
    expect(res.status).toBe(201);
    expect(Number(res.body.amount)).toBe(50);

    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(inv?.status).toBe('PARTIAL');
  });

  it('marks invoice PAID when full amount is received', async () => {
    await bootstrap();
    await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ invoiceId, amount: 118, method: 'UPI' });

    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(inv?.status).toBe('PAID');
  });

  it('rejects payment on already-paid invoice', async () => {
    await bootstrap();
    await request(app).post('/api/payments').set('Authorization', `Bearer ${adminToken}`).send({ invoiceId, amount: 118, method: 'CASH' });
    const res = await request(app).post('/api/payments').set('Authorization', `Bearer ${adminToken}`).send({ invoiceId, amount: 10, method: 'CASH' });
    expect(res.status).toBe(400);
  });

  it('rejects without auth', async () => {
    const res = await request(app).post('/api/payments').send({ invoiceId: 'x', amount: 10, method: 'CASH' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/payments/refund', () => {
  it('marks payment as refunded and updates invoice status', async () => {
    await bootstrap();
    const payRes = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ invoiceId, amount: 118, method: 'CARD' });
    const paymentId = payRes.body.id;

    const refRes = await request(app)
      .post('/api/payments/refund')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ paymentId });
    expect(refRes.status).toBe(200);
    expect(refRes.body.refunded).toBe(true);

    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(inv?.status).toBe('UNPAID');
  });

  it('cannot refund the same payment twice', async () => {
    await bootstrap();
    const payRes = await request(app).post('/api/payments').set('Authorization', `Bearer ${adminToken}`).send({ invoiceId, amount: 118, method: 'CASH' });
    const paymentId = payRes.body.id;

    await request(app).post('/api/payments/refund').set('Authorization', `Bearer ${adminToken}`).send({ paymentId });
    const res = await request(app).post('/api/payments/refund').set('Authorization', `Bearer ${adminToken}`).send({ paymentId });
    expect(res.status).toBe(400);
  });
});
