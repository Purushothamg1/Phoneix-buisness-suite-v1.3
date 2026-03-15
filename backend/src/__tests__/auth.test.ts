/**
 * Auth module unit tests
 * Run: npx jest --testPathPattern=auth.test.ts
 */
import { authService } from '../modules/auth/auth.service';

// Mock Prisma
jest.mock('../config/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import bcrypt from 'bcrypt';
import { prisma } from '../config/database';

const mockUser = {
  id: 'user-uuid',
  email: 'admin@phoneix.com',
  name: 'Admin',
  password: '$2b$12$hashedpassword',
  role: 'ADMIN' as const,
};

describe('authService.login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns token and user on valid credentials', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    process.env.JWT_SECRET = 'test-secret-32-chars-long-minimum';

    const result = await authService.login('admin@phoneix.com', 'Admin@1234');
    expect(result).toHaveProperty('token');
    expect(result.user.email).toBe('admin@phoneix.com');
    expect(result.user).not.toHaveProperty('password');
  });

  it('throws UnauthorizedError on wrong password', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(authService.login('admin@phoneix.com', 'wrong')).rejects.toThrow('Invalid email or password');
  });

  it('still runs bcrypt even when user not found (timing safety)', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(authService.login('nobody@phoneix.com', 'wrong')).rejects.toThrow('Invalid email or password');
    // bcrypt.compare MUST still have been called
    expect(bcrypt.compare).toHaveBeenCalledTimes(1);
  });

  it('normalises email to lowercase', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    process.env.JWT_SECRET = 'test-secret-32-chars-long-minimum';

    await authService.login('ADMIN@PHONEIX.COM', 'Admin@1234');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'admin@phoneix.com' },
    });
  });
});

describe('authService.changePassword', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects weak new passwords', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(authService.changePassword('user-uuid', 'OldPass@1', 'weak')).rejects.toThrow();
  });

  it('rejects if new password same as current', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(authService.changePassword('user-uuid', 'Same@1234', 'Same@1234')).rejects.toThrow('different');
  });
});
