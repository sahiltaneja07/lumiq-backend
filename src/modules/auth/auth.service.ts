import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '../../common/enums/role.enum';
import { HashUtil } from '../../common/utils/hash.util';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { AuthRepository } from './auth.repository';
import { RegisterDto } from './dto/register.dto';
import { AuthTokens } from './interfaces/auth-tokens.interface';
import { JwtPayload, JwtRefreshPayload } from './interfaces/jwt-payload.interface';
import { User, UserProfile } from '@prisma/client';

// Inline Redis client type — avoids mandatory ioredis dep for Phase 1 compile
export interface IRedisClient {
  set(key: string, value: string, expiryMode: string, time: number): Promise<string | null>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
}

const FAILED_ATTEMPTS_LOCKOUT = 5;
const LOCKOUT_DURATION_MINUTES = 15;

// Redis TTLs
const EMAIL_VERIFY_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const PASSWORD_RESET_TTL_SECONDS = 60 * 60; // 1 hour

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Registration ─────────────────────────────────────────────────────────

  async register(
    dto: RegisterDto,
    redisClient?: IRedisClient,
  ): Promise<{ user: User & { profile: UserProfile | null }; tokens: AuthTokens }> {
    const existingUser = await this.authRepository.findUserByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await HashUtil.hash(dto.password);
    const roles: Role[] = dto.role ? [dto.role] : [Role.DRIVER];

    const user = await this.authRepository.createUser({
      email: dto.email,
      passwordHash,
      roles,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    this.logger.log(`New user registered: ${user.id} (${user.email})`);

    // Queue email verification token in Redis (fire-and-forget)
    if (redisClient) {
      await this.sendEmailVerificationToken(user.id, user.email, redisClient).catch((err) => {
        this.logger.warn(`Could not queue verification email: ${err.message}`);
      });
    }

    await this.authRepository.createAuditLog({
      action: 'USER_REGISTER',
      entityName: 'User',
      entityId: user.id,
      userId: user.id,
    });

    const tokens = await this.generateTokenPair(user.id, user.email, user.roles as Role[]);
    return { user, tokens };
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(
    user: { id: string; email: string; roles: Role[] },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthTokens> {
    await this.authRepository.createAuditLog({
      action: 'USER_LOGIN',
      entityName: 'User',
      entityId: user.id,
      userId: user.id,
      ipAddress,
      userAgent,
    });

    return this.generateTokenPair(user.id, user.email, user.roles);
  }

  // ─── Local User Validation (used by LocalStrategy) ────────────────────────

  async validateLocalUser(
    email: string,
    password: string,
  ): Promise<{ id: string; email: string; roles: Role[] } | null> {
    const user = await this.authRepository.findUserByEmail(email);
    if (!user) {
      // Constant-time no-op to prevent timing attacks
      await HashUtil.hash(password);
      return null;
    }

    // Account lockout check
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      throw new ForbiddenException(
        `Account is temporarily locked. Try again after ${user.lockoutUntil.toISOString()}`,
      );
    }

    if (!user.passwordHash) {
      // OAuth-only account
      throw new BadRequestException(
        'This account uses social login. Please sign in with Google.',
      );
    }

    const isValid = await HashUtil.compare(password, user.passwordHash);
    if (!isValid) {
      const updated = await this.authRepository.recordFailedAttempt(user.id);
      if (updated.failedAttempts >= FAILED_ATTEMPTS_LOCKOUT) {
        const lockoutUntil = new Date(
          Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000,
        );
        await this.authRepository.lockAccount(user.id, lockoutUntil);
        this.logger.warn(`Account locked after failed attempts: ${user.id}`);
        throw new ForbiddenException(
          `Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.`,
        );
      }
      return null;
    }

    // Reset failed attempts on success
    await this.authRepository.resetFailedAttempts(user.id);

    return {
      id: user.id,
      email: user.email,
      roles: user.roles as Role[],
    };
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  async logout(userId: string, refreshToken: string): Promise<void> {
    const hashedToken = CryptoUtil.hashToken(refreshToken);
    const tokenRecord = await this.authRepository.findRefreshToken(hashedToken);
    if (tokenRecord && tokenRecord.userId === userId) {
      await this.authRepository.revokeRefreshToken(tokenRecord.id);
    }

    await this.authRepository.createAuditLog({
      action: 'USER_LOGOUT',
      entityName: 'User',
      entityId: userId,
      userId,
    });
  }

  // ─── Refresh Tokens ───────────────────────────────────────────────────────

  async refreshTokens(
    userId: string,
    email: string,
    roles: Role[],
    oldTokenId: string,
  ): Promise<AuthTokens> {
    // Rotate: revoke old, issue new
    await this.authRepository.revokeRefreshToken(oldTokenId);
    return this.generateTokenPair(userId, email, roles);
  }

  // ─── Email Verification ───────────────────────────────────────────────────

  async sendEmailVerificationToken(
    userId: string,
    email: string,
    redisClient: IRedisClient,
  ): Promise<string> {
    const rawToken = CryptoUtil.generateToken();
    const hashedToken = CryptoUtil.hashToken(rawToken);
    const redisKey = `verify:email:${hashedToken}`;

    await redisClient.set(redisKey, userId, 'EX', EMAIL_VERIFY_TTL_SECONDS);
    this.logger.log(`Email verification token stored for user ${userId}`);

    // TODO: Integrate Resend/Nodemailer email service in Phase 2
    // For now log the raw token (development only)
    if (this.configService.get('app.nodeEnv') !== 'production') {
      this.logger.debug(`[DEV] Email verification token for ${email}: ${rawToken}`);
    }

    return rawToken;
  }

  async verifyEmail(token: string, redisClient: IRedisClient): Promise<void> {
    const hashedToken = CryptoUtil.hashToken(token);
    const redisKey = `verify:email:${hashedToken}`;

    const userId = await redisClient.get(redisKey);
    if (!userId) {
      throw new BadRequestException('Verification token is invalid or has expired');
    }

    const user = await this.authRepository.findUserByIdRaw(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isEmailVerified) {
      await redisClient.del(redisKey);
      throw new BadRequestException('Email is already verified');
    }

    await this.authRepository.markEmailVerified(userId);
    await redisClient.del(redisKey);

    await this.authRepository.createAuditLog({
      action: 'EMAIL_VERIFIED',
      entityName: 'User',
      entityId: userId,
      userId,
    });

    this.logger.log(`Email verified for user: ${userId}`);
  }

  // ─── Password Reset ───────────────────────────────────────────────────────

  async forgotPassword(email: string, redisClient: IRedisClient): Promise<void> {
    const user = await this.authRepository.findUserByEmail(email);

    // Always return success to prevent email enumeration
    if (!user) {
      this.logger.warn(`Forgot password attempted for non-existent email: ${email}`);
      return;
    }

    if (!user.passwordHash) {
      this.logger.warn(`Forgot password attempted for OAuth account: ${user.id}`);
      return;
    }

    const rawToken = CryptoUtil.generateToken();
    const hashedToken = CryptoUtil.hashToken(rawToken);
    const redisKey = `reset:${hashedToken}`;

    await redisClient.set(redisKey, user.id, 'EX', PASSWORD_RESET_TTL_SECONDS);

    // TODO: Integrate email service in Phase 2
    if (this.configService.get('app.nodeEnv') !== 'production') {
      this.logger.debug(`[DEV] Password reset token for ${email}: ${rawToken}`);
    }

    await this.authRepository.createAuditLog({
      action: 'PASSWORD_RESET_REQUESTED',
      entityName: 'User',
      entityId: user.id,
      userId: user.id,
    });

    this.logger.log(`Password reset token generated for: ${user.id}`);
  }

  async resetPassword(token: string, newPassword: string, redisClient: IRedisClient): Promise<void> {
    const hashedToken = CryptoUtil.hashToken(token);
    const redisKey = `reset:${hashedToken}`;

    const userId = await redisClient.get(redisKey);
    if (!userId) {
      throw new BadRequestException('Reset token is invalid or has expired');
    }

    const user = await this.authRepository.findUserByIdRaw(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const newHash = await HashUtil.hash(newPassword);
    await this.authRepository.updatePassword(userId, newHash);

    // Invalidate all existing refresh tokens (security: force re-login on all devices)
    await this.authRepository.revokeAllUserRefreshTokens(userId);

    await redisClient.del(redisKey);

    await this.authRepository.createAuditLog({
      action: 'PASSWORD_RESET_COMPLETED',
      entityName: 'User',
      entityId: userId,
      userId,
    });

    this.logger.log(`Password reset completed for user: ${userId}`);
  }

  // ─── Change Password ──────────────────────────────────────────────────────

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.authRepository.findUserByIdRaw(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.passwordHash) {
      throw new BadRequestException('This account uses social login and has no password');
    }

    const isValid = await HashUtil.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await HashUtil.hash(newPassword);
    await this.authRepository.updatePassword(userId, newHash);

    // Revoke all tokens to force re-login on other devices
    await this.authRepository.revokeAllUserRefreshTokens(userId);

    await this.authRepository.createAuditLog({
      action: 'PASSWORD_CHANGED',
      entityName: 'User',
      entityId: userId,
      userId,
    });

    this.logger.log(`Password changed for user: ${userId}`);
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────────

  async validateOrCreateGoogleUser(googleUser: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  }): Promise<{ id: string; email: string; roles: Role[] }> {
    let user = await this.authRepository.findUserByEmail(googleUser.email);

    if (!user) {
      // Create new OAuth user (no password)
      user = await this.authRepository.createUser({
        email: googleUser.email,
        passwordHash: undefined,
        roles: [Role.DRIVER],
        firstName: googleUser.firstName,
        lastName: googleUser.lastName,
      });

      // Mark email as verified since Google has already verified it
      await this.authRepository.markEmailVerified(user.id);

      this.logger.log(`New Google OAuth user created: ${user.id}`);
      await this.authRepository.createAuditLog({
        action: 'USER_REGISTER_GOOGLE',
        entityName: 'User',
        entityId: user.id,
        userId: user.id,
      });
    }

    return {
      id: user.id,
      email: user.email,
      roles: user.roles as Role[],
    };
  }

  // ─── Token Pair Generation ────────────────────────────────────────────────

  async generateTokenPair(
    userId: string,
    email: string,
    roles: Role[],
  ): Promise<AuthTokens> {
    const accessPayload: JwtPayload = {
      sub: userId,
      email,
      roles,
      type: 'access',
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: (this.configService.get<string>('jwt.expiration') ?? '15m') as any,
    });

    // Store refresh token in DB
    const refreshExpirationStr = this.configService.get<string>('jwt.refreshExpiration') ?? '7d';
    const expiresAt = this.parseExpirationToDate(refreshExpirationStr);

    const refreshTokenRecord = await this.authRepository.createRefreshToken({
      userId,
      token: CryptoUtil.hashToken(userId + Date.now().toString()), // Placeholder; real token set below
      expiresAt,
    });

    const refreshPayload: JwtRefreshPayload = {
      sub: userId,
      tokenId: refreshTokenRecord.id,
      type: 'refresh',
    };

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: refreshExpirationStr as any,
    });

    // Update DB record with the hashed signed token
    await this.authRepository['prisma'].refreshToken.update({
      where: { id: refreshTokenRecord.id },
      data: { token: CryptoUtil.hashToken(refreshToken) },
    });

    const expiresInSeconds = this.parseExpirationToSeconds(
      this.configService.get<string>('jwt.expiration') ?? '15m',
    );

    return { accessToken, refreshToken, expiresIn: expiresInSeconds };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private parseExpirationToDate(expiration: string): Date {
    const seconds = this.parseExpirationToSeconds(expiration);
    return new Date(Date.now() + seconds * 1000);
  }

  private parseExpirationToSeconds(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // default 15 min
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[unit] ?? 60);
  }
}
