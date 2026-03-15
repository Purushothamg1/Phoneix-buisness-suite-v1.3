import request from 'supertest';
import app from '../../src/app';
import { cleanDb, createTestUser, generateToken, prisma } from '../setup';

beforeEach(cleanDb);

// ─── Settings Tests ───────────────────────────────────────

describe('GET /api/settings', () => {
  it('returns settings object (authenticated)', async () => {
    const user = await createTestUser('STAFF');
    const token = generateToken(user.id, 'STAFF');

    await prisma.setting.createMany({
      data: [
        { key: 'business_name', value: 'Test Business' },
        { key: 'currency_symbol', value: '₹' },
      ],
    });

    const res = await request(app).get('/api/settings').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.business_name).toBe('Test Business');
    expect(res.body.currency_symbol).toBe('₹');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/settings', () => {
  it('allows ADMIN to update settings', async () => {
    const user = await createTestUser('ADMIN');
    const token = generateToken(user.id, 'ADMIN');

    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ business_name: 'Updated Biz', default_tax: '18' });

    expect(res.status).toBe(200);
    expect(res.body.business_name).toBe('Updated Biz');
    expect(res.body.default_tax).toBe('18');
  });

  it('forbids STAFF from updating settings', async () => {
    const user = await createTestUser('STAFF');
    const token = generateToken(user.id, 'STAFF');

    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ business_name: 'Hacked' });

    expect(res.status).toBe(403);
  });

  it('upserts — creates new key if not exists', async () => {
    const user = await createTestUser('ADMIN');
    const token = generateToken(user.id, 'ADMIN');

    await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ new_custom_key: 'new_value' });

    const setting = await prisma.setting.findUnique({ where: { key: 'new_custom_key' } });
    expect(setting?.value).toBe('new_value');
  });
});

// ─── Search Tests ─────────────────────────────────────────

describe('GET /api/search', () => {
  it('returns results across all entities', async () => {
    const user = await createTestUser('ADMIN');
    const token = generateToken(user.id, 'ADMIN');

    await prisma.customer.create({ data: { name: 'Rohan Sharma', phone: '9111111111' } });
    await prisma.product.create({ data: { name: 'iPhone 15', sku: 'IPH-15', purchasePrice: 60000, sellingPrice: 75000 } });

    const res = await request(app).get('/api/search?q=iphone').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeGreaterThan(0);
  });

  it('requires at least 2 characters', async () => {
    const user = await createTestUser('STAFF');
    const token = generateToken(user.id, 'STAFF');

    const res = await request(app).get('/api/search?q=a').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/search?q=test');
    expect(res.status).toBe(401);
  });
});

// ─── Dashboard Tests ──────────────────────────────────────

describe('GET /api/dashboard', () => {
  it('returns all dashboard widgets', async () => {
    const user = await createTestUser('ADMIN');
    const token = generateToken(user.id, 'ADMIN');

    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('todaySales');
    expect(res.body).toHaveProperty('monthlyRevenue');
    expect(res.body).toHaveProperty('activeRepairs');
    expect(res.body).toHaveProperty('lowStockAlerts');
    expect(res.body).toHaveProperty('recentInvoices');
    expect(res.body).toHaveProperty('recentRepairs');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(401);
  });
});
