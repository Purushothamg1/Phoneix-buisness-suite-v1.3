import request from 'supertest';
import app from '../../src/app';
import { cleanDb, createTestUser, generateToken, prisma } from '../setup';

beforeEach(cleanDb);

describe('GET /api/auth/users', () => {
  it('allows ADMIN to list users', async () => {
    const admin = await createTestUser('ADMIN');
    await createTestUser('MANAGER');
    const token = generateToken(admin.id, 'ADMIN');

    const res = await request(app).get('/api/auth/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    // passwords must NOT be returned
    expect(res.body[0]).not.toHaveProperty('password');
  });

  it('forbids MANAGER from listing users', async () => {
    const manager = await createTestUser('MANAGER');
    const token = generateToken(manager.id, 'MANAGER');
    const res = await request(app).get('/api/auth/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/auth/users', () => {
  it('creates a new user', async () => {
    const admin = await createTestUser('ADMIN');
    const token = generateToken(admin.id, 'ADMIN');

    const res = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Staff', email: 'staff@test.com', password: 'Password@1', role: 'STAFF' });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('staff@test.com');
    expect(res.body.role).toBe('STAFF');
    expect(res.body).not.toHaveProperty('password');
  });

  it('rejects duplicate email', async () => {
    const admin = await createTestUser('ADMIN');
    const token = generateToken(admin.id, 'ADMIN');

    await request(app).post('/api/auth/users').set('Authorization', `Bearer ${token}`)
      .send({ name: 'User A', email: 'dupe@test.com', password: 'Password@1', role: 'STAFF' });

    const res = await request(app).post('/api/auth/users').set('Authorization', `Bearer ${token}`)
      .send({ name: 'User B', email: 'dupe@test.com', password: 'Password@1', role: 'STAFF' });

    expect(res.status).toBe(409);
  });

  it('rejects short password', async () => {
    const admin = await createTestUser('ADMIN');
    const token = generateToken(admin.id, 'ADMIN');

    const res = await request(app).post('/api/auth/users').set('Authorization', `Bearer ${token}`)
      .send({ name: 'X', email: 'x@test.com', password: 'short', role: 'STAFF' });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/auth/users/:id', () => {
  it('allows ADMIN to delete another user', async () => {
    const admin = await createTestUser('ADMIN');
    const staff = await createTestUser('STAFF');
    const token = generateToken(admin.id, 'ADMIN');

    const res = await request(app)
      .delete(`/api/auth/users/${staff.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    const deleted = await prisma.user.findUnique({ where: { id: staff.id } });
    expect(deleted).toBeNull();
  });

  it('prevents admin from deleting themselves', async () => {
    const admin = await createTestUser('ADMIN');
    const token = generateToken(admin.id, 'ADMIN');

    const res = await request(app)
      .delete(`/api/auth/users/${admin.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});
