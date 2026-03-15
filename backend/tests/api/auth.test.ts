import request from 'supertest';
import app from '../../src/app';
import { cleanDb, createTestUser, prisma } from '../setup';

beforeEach(cleanDb);

describe('POST /api/auth/login', () => {
  it('returns token on valid credentials', async () => {
    await createTestUser('ADMIN');
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'Test@1234' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({ email: 'admin@test.com', role: 'ADMIN' });
  });

  it('returns 401 on wrong password', async () => {
    await createTestUser('ADMIN');
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('returns 401 on unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@test.com', password: 'Test@1234' });
    expect(res.status).toBe(401);
  });

  it('returns 400 on missing fields', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.com' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('returns current user with valid token', async () => {
    const user = await createTestUser('ADMIN');
    const loginRes = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'Test@1234' });
    const token = loginRes.body.token;
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});
