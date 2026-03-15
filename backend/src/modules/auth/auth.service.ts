import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { UnauthorizedError, NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { auditLog } from '../../shared/utils/auditLog';

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

function validatePasswordStrength(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new ValidationError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (!PASSWORD_REGEX.test(password)) {
    throw new ValidationError('Password must contain at least one uppercase letter, one lowercase letter, and one number');
  }
}

export const authService = {
  async login(email: string, password: string) {
    // Always run bcrypt compare — prevents timing-based user enumeration
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    const DUMMY_HASH = '$2b$12$invalidhashfortimingnormalizationXXXXXXXXXXXXXXXXXXXX';
    const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

    if (!user || !valid) {
      // Audit failed login attempt (if user exists)
      if (user) {
        await auditLog({ userId: user.id, action: 'USER_LOGIN', metadata: { success: false, email } });
      }
      throw new UnauthorizedError('Invalid email or password');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      secret,
      { expiresIn: (process.env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']) || '8h' },
    );

    await auditLog({ userId: user.id, action: 'USER_LOGIN', metadata: { success: true } });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  },

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    if (!user) throw new NotFoundError('User');
    return user;
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new ValidationError('Current password is incorrect');

    if (currentPassword === newPassword) {
      throw new ValidationError('New password must be different from the current password');
    }

    validatePasswordStrength(newPassword);

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

    await auditLog({ userId, action: 'PASSWORD_CHANGED' });

    return { message: 'Password changed successfully' };
  },
};
