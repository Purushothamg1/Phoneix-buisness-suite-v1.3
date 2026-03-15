import request from 'supertest';
import app from '../../src/app';
import { cleanDb, createTestUser, generateToken, prisma } from '../setup';

let adminToken: string;

beforeEach(async () => {
  await cleanDb();
  const admin = await createTestUser('ADMIN');
  adminToken = generateToken(admin.id, admin.role);
  await prisma.customer.create({ data: { name: 'Alice Sharma', phone: '9000000001' } });
  await prisma.product.create({ data: { name: 'OnePlus Charger', sku: 'OP-CHG-001', purchasePrice: 100, sellingPrice: 200, stockQty: 5, minStockLevel: 2 } });
});

describe('GET /api/search', () => {
  it('finds customer by name', async () => {
    const res = await request(app).get('/api/search?q=Alice').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.customers.length).toBeGreaterThan(0);
    expect(res.body.customers[0].name).toBe('Alice Sharma');
  });

  it('finds product by name', async () => {
    const res = await request(app).get('/api/search?q=OnePlus').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeGreaterThan(0);
  });

  it('returns 400 for query shorter than 2 chars', async () => {
    const res = await request(app).get('/api/search?q=a').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/dashboard', () => {
  it('returns all dashboard widgets', async () => {
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('todaySales');
    expect(res.body).toHaveProperty('monthlyRevenue');
    expect(res.body).toHaveProperty('activeRepairs');
    expect(res.body).toHaveProperty('lowStockAlerts');
    expect(res.body).toHaveProperty('recentInvoices');
    expect(res.body).toHaveProperty('recentRepairs');
  });
});
