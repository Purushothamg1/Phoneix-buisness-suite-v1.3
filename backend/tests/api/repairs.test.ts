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
  const customer = await prisma.customer.create({ data: { name: 'Repair Customer', phone: '9998887770' } });
  customerId = customer.id;
  const product = await prisma.product.create({
    data: { name: 'Spare Part', sku: 'PART-001', purchasePrice: 50, sellingPrice: 80, stockQty: 10, minStockLevel: 2 },
  });
  productId = product.id;
});

const repairPayload = {
  deviceType: 'Mobile',
  brand: 'Samsung',
  model: 'Galaxy S22',
  issueDescription: 'Screen cracked',
};

describe('POST /api/repairs', () => {
  it('creates repair job with auto job ID', async () => {
    const res = await request(app).post('/api/repairs').set('Authorization', `Bearer ${adminToken}`)
      .send({ ...repairPayload, customerId });
    expect(res.status).toBe(201);
    expect(res.body.jobId).toMatch(/^JOB-/);
    expect(res.body.status).toBe('RECEIVED');
  });

  it('creates repair job and deducts stock for parts', async () => {
    const res = await request(app).post('/api/repairs').set('Authorization', `Bearer ${adminToken}`)
      .send({ ...repairPayload, customerId, parts: [{ productId, qty: 2, cost: 50 }] });
    expect(res.status).toBe(201);
    const product = await prisma.product.findUnique({ where: { id: productId } });
    expect(product?.stockQty).toBe(8);
  });
});

describe('PUT /api/repairs/:id', () => {
  it('updates repair status', async () => {
    const create = await request(app).post('/api/repairs').set('Authorization', `Bearer ${adminToken}`)
      .send({ ...repairPayload, customerId });
    const id = create.body.id;

    const res = await request(app).put(`/api/repairs/${id}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'IN_REPAIR', repairNotes: 'Opened device, ordering screen.' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_REPAIR');
    expect(res.body.repairNotes).toBe('Opened device, ordering screen.');
  });
});

describe('GET /api/repairs', () => {
  it('returns paginated list with filters', async () => {
    await request(app).post('/api/repairs').set('Authorization', `Bearer ${adminToken}`).send({ ...repairPayload, customerId });
    const res = await request(app).get('/api/repairs?status=RECEIVED').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].status).toBe('RECEIVED');
  });
});
