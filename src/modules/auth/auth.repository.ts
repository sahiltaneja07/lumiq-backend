import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RefreshToken, User, UserProfile } from '@prisma/client';

@Injectable()
export class AuthRepository {
  private readonly logger = new Logger(AuthRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── User Lookups ─────────────────────────────────────────────────────────

  async findUserByEmail(email: string): Promise<(User & { profile: UserProfile | null }) | null> {
    return this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        deletedAt: null,
      },
      include: { profile: true },
    });
  }

  async findUserById(id: string): Promise<(User & { profile: UserProfile | null }) | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { profile: true },
    });
  }

  async findUserByIdRaw(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  // ─── User Creation ────────────────────────────────────────────────────────

  async createUser(data: {
    email: string;
    passwordHash?: string;
    roles?: string[];
    firstName: string;
    lastName: string;
  }): Promise<User & { profile: UserProfile | null }> {
    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        passwordHash: data.passwordHash,
        roles: data.roles as any,
        isEmailVerified: false,
        profile: {
          create: {
            firstName: data.firstName,
            lastName: data.lastName,
          },
        },
      },
      include: { profile: true },
    });
  }

  // ─── User Updates ─────────────────────────────────────────────────────────

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, failedAttempts: 0, lockoutUntil: null },
    });
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true },
    });
  }

  async recordFailedAttempt(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { failedAttempts: { increment: 1 } },
    });
  }

  async lockAccount(userId: string, until: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lockoutUntil: until },
    });
  }

  async resetFailedAttempts(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedAttempts: 0, lockoutUntil: null },
    });
  }

  // ─── Refresh Tokens ───────────────────────────────────────────────────────

  async createRefreshToken(data: {
    userId: string;
    token: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  async findRefreshToken(token: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findFirst({
      where: { token, revokedAt: null },
    });
  }

  async findRefreshTokenById(id: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findFirst({
      where: { id, revokedAt: null },
    });
  }

  async revokeRefreshToken(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async deleteExpiredRefreshTokens(): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }

  // ─── Audit Logging ────────────────────────────────────────────────────────

  async createAuditLog(data: {
    action: string;
    entityName: string;
    entityId?: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    newValue?: Record<string, any>;
  }): Promise<void> {
    await this.prisma.auditLog.create({ data }).catch((err) => {
      this.logger.warn(`Failed to write audit log: ${err.message}`);
    });
  }
}
