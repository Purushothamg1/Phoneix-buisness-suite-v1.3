import request from 'supertest';
import app from '../../src/app';
import { cleanDb, createTestUser, generateToken } from '../setup';

let adminToken: string;
let staffToken: string;

beforeEach(async () => {
  await cleanDb();
  const admin = await createTestUser('ADMIN');
  const staff = await createTestUser('STAFF');
  adminToken = generateToken(admin.id, admin.role);
  staffToken = generateToken(staff.id, staff.role);
});

const sampleCustomer = { name: 'John Doe', phone: '9876543210', email: 'john@example.com', address: '123 Street' };

describe('GET /api/customers', () => {
  it('returns paginated list', async () => {
    const res = await request(app).get('/api/customers').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/customers', () => {
  it('creates customer with valid data', async () => {
    const res = await request(app).post('/api/customers').set('Authorization', `Bearer ${adminToken}`).send(sampleCustomer);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('John Doe');
    expect(res.body.phone).toBe('9876543210');
  });

  it('returns 409 on duplicate phone', async () => {
    await request(app).post('/api/customers').set('Authorization', `Bearer ${adminToken}`).send(sampleCustomer);
    const res = await request(app).post('/api/customers').set('Authorization', `Bearer ${adminToken}`).send(sampleCustomer);
    expect(res.status).toBe(409);
  });

  it('returns 400 on missing required fields', async () => {
    const res = await request(app).post('/api/customers').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Only Name' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/customers/:id', () => {
  it('updates customer', async () => {
    const create = await request(app).post('/api/customers').set('Authorization', `Bearer ${adminToken}`).send(sampleCustomer);
    const id = create.body.id;
    const res = await request(app).put(`/api/customers/${id}`).set('Authorization', `Bearer ${adminToken}`).send({ ...sampleCustomer, name: 'Jane Doe' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Jane Doe');
  });
});

describe('DELETE /api/customers/:id', () => {
  it('deletes customer', async () => {
    const create = await request(app).post('/api/customers').set('Authorization', `Bearer ${adminToken}`).send(sampleCustomer);
    const id = create.body.id;
    const res = await request(app).delete(`/api/customers/${id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);
  });

  it('returns 404 for non-existent customer', async () => {
    const res = await request(app).delete('/api/customers/00000000-0000-0000-0000-000000000000').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
