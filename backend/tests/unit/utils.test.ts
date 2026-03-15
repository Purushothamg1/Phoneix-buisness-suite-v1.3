import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// ─── AppError unit tests ──────────────────────────────────

describe('AppError classes', () => {
  const { AppError, NotFoundError, ValidationError, UnauthorizedError, ForbiddenError, ConflictError } =
    require('../../src/shared/errors/AppError');

  it('AppError sets statusCode and message', () => {
    const err = new AppError('Something broke', 500);
    expect(err.message).toBe('Something broke');
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(true);
  });

  it('NotFoundError is 404', () => {
    const err = new NotFoundError('Invoice');
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain('Invoice');
  });

  it('ValidationError is 400', () => {
    const err = new ValidationError('Invalid input');
    expect(err.statusCode).toBe(400);
  });

  it('UnauthorizedError is 401', () => {
    expect(new UnauthorizedError().statusCode).toBe(401);
  });

  it('ForbiddenError is 403', () => {
    expect(new ForbiddenError().statusCode).toBe(403);
  });

  it('ConflictError is 409', () => {
    expect(new ConflictError('Duplicate').statusCode).toBe(409);
  });
});

// ─── Pagination utility tests ─────────────────────────────

describe('getPaginationParams', () => {
  const { getPaginationParams, buildPaginatedResult } = require('../../src/shared/utils/pagination');

  it('returns defaults for empty query', () => {
    const params = getPaginationParams({});
    expect(params.page).toBe(1);
    expect(params.limit).toBe(20);
    expect(params.skip).toBe(0);
  });

  it('calculates skip correctly', () => {
    const params = getPaginationParams({ page: '3', limit: '10' });
    expect(params.skip).toBe(20);
  });

  it('clamps limit to 100', () => {
    const params = getPaginationParams({ limit: '9999' });
    expect(params.limit).toBe(100);
  });

  it('clamps page to minimum 1', () => {
    const params = getPaginationParams({ page: '-5' });
    expect(params.page).toBe(1);
  });

  it('buildPaginatedResult calculates meta correctly', () => {
    const result = buildPaginatedResult(['a', 'b', 'c'], 25, { page: 2, limit: 10, skip: 10 });
    expect(result.meta.totalPages).toBe(3);
    expect(result.meta.hasNext).toBe(true);
    expect(result.meta.hasPrev).toBe(true);
    expect(result.data).toHaveLength(3);
  });

  it('hasNext is false on last page', () => {
    const result = buildPaginatedResult(['x'], 10, { page: 2, limit: 10, skip: 10 });
    expect(result.meta.hasNext).toBe(false);
  });
});

// ─── JWT utility tests ────────────────────────────────────

describe('JWT token generation', () => {
  const SECRET = 'unit_test_secret';

  it('generates a valid JWT that decodes correctly', () => {
    const payload = { userId: 'abc-123', role: 'ADMIN' };
    const token = jwt.sign(payload, SECRET, { expiresIn: '1h' });
    const decoded = jwt.verify(token, SECRET) as typeof payload;
    expect(decoded.userId).toBe('abc-123');
    expect(decoded.role).toBe('ADMIN');
  });

  it('throws on tampered token', () => {
    const token = jwt.sign({ userId: 'x', role: 'STAFF' }, SECRET);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => jwt.verify(tampered, SECRET)).toThrow();
  });

  it('throws on expired token', async () => {
    const token = jwt.sign({ userId: 'x' }, SECRET, { expiresIn: '1ms' });
    await new Promise((r) => setTimeout(r, 5));
    expect(() => jwt.verify(token, SECRET)).toThrow(/expired/);
  });
});

// ─── bcrypt utility tests ─────────────────────────────────

describe('bcrypt password hashing', () => {
  it('hashes and verifies a password', async () => {
    const plain = 'MyPassword@123';
    const hash = await bcrypt.hash(plain, 10);
    expect(hash).not.toBe(plain);
    expect(await bcrypt.compare(plain, hash)).toBe(true);
    expect(await bcrypt.compare('wrong', hash)).toBe(false);
  });
});
