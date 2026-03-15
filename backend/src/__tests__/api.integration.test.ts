/**
 * API Integration Tests
 * These tests run against a live test database.
 *
 * Prerequisites:
 *   export TEST_DATABASE_URL=postgresql://phoneix:test@localhost:5432/phoneix_test
 *   npx prisma migrate deploy
 *   npx jest --testPathPattern=api.integration.test.ts
 *
 * Note: These tests require a running PostgreSQL instance.
 * In CI, run: docker run -d -e POSTGRES_DB=phoneix_test -e POSTGRES_USER=phoneix
 *              -e POSTGRES_PASSWORD=test -p 5432:5432 postgres:16-alpine
 */

import request from 'supertest';
import app from '../app';

const BASE = '/api';
let adminToken: string;

beforeAll(async () => {
  // Login as seeded admin
  const res = await request(app)
    .post(`${BASE}/auth/login`)
    .send({ email: 'admin@phoneix.com', password: 'Admin@1234' });

  if (res.status === 200) {
    adminToken = res.body.token;
  } else {
    console.warn('Could not get admin token — integration tests will be skipped');
  }
});

const auth = () => ({
  Authorization: `Bearer ${adminToken}`,
});

describe('Health', () => {
  it('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Auth', () => {
  it('POST /auth/login → 200 on valid credentials', async () => {
    const res = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ email: 'admin@phoneix.com', password: 'Admin@1234' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.role).toBe('ADMIN');
  });

  it('POST /auth/login → 401 on wrong password', async () => {
    const res = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ email: 'admin@phoneix.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('GET /auth/me → 401 without token', async () => {
    const res = await request(app).get(`${BASE}/auth/me`);
    expect(res.status).toBe(401);
  });

  it('GET /auth/me → 200 with valid token', async () => {
    if (!adminToken) return;
    const res = await request(app).get(`${BASE}/auth/me`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@phoneix.com');
  });
});

describe('Customers', () => {
  it('GET /customers → 401 without auth', async () => {
    const res = await request(app).get(`${BASE}/customers`);
    expect(res.status).toBe(401);
  });

  it('GET /customers → 200 paginated', async () => {
    if (!adminToken) return;
    const res = await request(app).get(`${BASE}/customers`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta).toHaveProperty('total');
  });

  it('POST /customers → 400 missing required fields', async () => {
    if (!adminToken) return;
    const res = await request(app)
      .post(`${BASE}/customers`)
      .set(auth())
      .send({ name: 'No Phone' });
    expect(res.status).toBe(400);
  });
});

describe('Products', () => {
  it('GET /products → paginated list', async () => {
    if (!adminToken) return;
    const res = await request(app).get(`${BASE}/products`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  it('GET /products/low-stock → array', async () => {
    if (!adminToken) return;
    const res = await request(app).get(`${BASE}/products/low-stock`).set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /products/categories → array of strings', async () => {
    if (!adminToken) return;
    const res = await request(app).get(`${BASE}/products/categories`).set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Dashboard', () => {
  it('GET /dashboard → returns all KPI fields', async () => {
    if (!adminToken) return;
    const res = await request(app).get(`${BASE}/dashboard`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('todaySales');
    expect(res.body).toHaveProperty('monthlyRevenue');
    expect(res.body).toHaveProperty('activeRepairs');
    expect(res.body).toHaveProperty('lowStockAlerts');
    expect(res.body).toHaveProperty('salesByDay');
    // New: lowStockItems array
    expect(res.body).toHaveProperty('lowStockItems');
    expect(Array.isArray(res.body.lowStockItems)).toBe(true);
  });
});

describe('Settings', () => {
  it('GET /settings → returns key-value object', async () => {
    if (!adminToken) return;
    const res = await request(app).get(`${BASE}/settings`).set(auth());
    expect(res.status).toBe(200);
    expect(typeof res.body).toBe('object');
  });

  it('PUT /settings → rejects unknown keys', async () => {
    if (!adminToken) return;
    const res = await request(app)
      .put(`${BASE}/settings`)
      .set(auth())
      .send({ unknown_key_injection: 'malicious' });
    // Should either 400 (Joi) or ignore the key and return current settings
    // Either way, the unknown key should not appear in the response
    if (res.status === 200) {
      expect(res.body).not.toHaveProperty('unknown_key_injection');
    } else {
      expect(res.status).toBe(400);
    }
  });
});

describe('Search', () => {
  it('GET /search requires at least 2 characters', async () => {
    if (!adminToken) return;
    const res = await request(app).get(`${BASE}/search?q=a`).set(auth());
    expect(res.status).toBe(400);
  });

  it('GET /search returns categorised results', async () => {
    if (!adminToken) return;
    const res = await request(app).get(`${BASE}/search?q=ad`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('customers');
    expect(res.body).toHaveProperty('products');
    expect(res.body).toHaveProperty('invoices');
    expect(res.body).toHaveProperty('repairs');
  });
});
