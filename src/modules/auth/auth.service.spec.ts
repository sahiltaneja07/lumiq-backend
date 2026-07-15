import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { RegisterDto } from './dto/register.dto';
import { Role } from '../../common/enums/role.enum';
import { HashUtil } from '../../common/utils/hash.util';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockAuthRepository = {
  findUserByEmail: jest.fn(),
  findUserByIdRaw: jest.fn(),
  findRefreshTokenById: jest.fn(),
  findRefreshToken: jest.fn(),
  createUser: jest.fn(),
  createRefreshToken: jest.fn(),
  updatePassword: jest.fn(),
  markEmailVerified: jest.fn(),
  recordFailedAttempt: jest.fn(),
  lockAccount: jest.fn(),
  resetFailedAttempts: jest.fn(),
  revokeRefreshToken: jest.fn(),
  revokeAllUserRefreshTokens: jest.fn(),
  createAuditLog: jest.fn(),
  prisma: {
    refreshToken: {
      update: jest.fn(),
    },
  },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      'jwt.secret': 'test-secret',
      'jwt.expiration': '15m',
      'jwt.refreshSecret': 'test-refresh-secret',
      'jwt.refreshExpiration': '7d',
      'app.nodeEnv': 'test',
    };
    return config[key];
  }),
};

const mockRedisClient = {
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn(),
  del: jest.fn().mockResolvedValue(1),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;
  let authRepository: typeof mockAuthRepository;

  const baseUser = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    passwordHash: '$2b$10$hashedpassword',
    roles: [Role.DRIVER],
    isEmailVerified: false,
    failedAttempts: 0,
    lockoutUntil: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: { id: 'profile-1', firstName: 'John', lastName: 'Doe' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockAuthRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    authRepository = module.get(AuthRepository);

    // Reset all mocks between tests
    jest.clearAllMocks();

    // Setup default mock implementations
    mockAuthRepository.createRefreshToken.mockResolvedValue({ id: 'token-uuid-1' });
    mockAuthRepository.prisma.refreshToken.update.mockResolvedValue({});
    mockAuthRepository.createAuditLog.mockResolvedValue(undefined);
  });

  // ─── register() ────────────────────────────────────────────────────────────

  describe('register()', () => {
    const registerDto: RegisterDto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'StrongP@ss123',
    };

    it('should create a new user and return tokens', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue(null);
      mockAuthRepository.createUser.mockResolvedValue({
        ...baseUser,
        email: registerDto.email,
      });

      const result = await service.register(registerDto);

      expect(mockAuthRepository.findUserByEmail).toHaveBeenCalledWith(registerDto.email);
      expect(mockAuthRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: registerDto.email,
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          roles: [Role.DRIVER],
        }),
      );
      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.tokens).toHaveProperty('refreshToken');
      expect(result.tokens).toHaveProperty('expiresIn');
    });

    it('should throw ConflictException if email already exists', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue(baseUser);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should assign DRIVER role by default', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue(null);
      mockAuthRepository.createUser.mockResolvedValue(baseUser);

      await service.register(registerDto);

      expect(mockAuthRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ roles: [Role.DRIVER] }),
      );
    });

    it('should allow HOST role registration', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue(null);
      mockAuthRepository.createUser.mockResolvedValue({ ...baseUser, roles: [Role.HOST] });

      await service.register({ ...registerDto, role: Role.HOST });

      expect(mockAuthRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ roles: [Role.HOST] }),
      );
    });
  });

  // ─── validateLocalUser() ───────────────────────────────────────────────────

  describe('validateLocalUser()', () => {
    it('should return user object on valid credentials', async () => {
      const hashedPassword = await HashUtil.hash('StrongP@ss123');
      mockAuthRepository.findUserByEmail.mockResolvedValue({
        ...baseUser,
        passwordHash: hashedPassword,
      });
      mockAuthRepository.resetFailedAttempts.mockResolvedValue(undefined);

      const result = await service.validateLocalUser('test@example.com', 'StrongP@ss123');

      expect(result).toEqual({
        id: baseUser.id,
        email: baseUser.email,
        roles: baseUser.roles,
      });
    });

    it('should return null for non-existent user (timing-safe)', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue(null);

      const result = await service.validateLocalUser('nobody@example.com', 'password');
      expect(result).toBeNull();
    });

    it('should return null and increment failedAttempts for wrong password', async () => {
      const hashedPassword = await HashUtil.hash('CorrectP@ss123');
      mockAuthRepository.findUserByEmail.mockResolvedValue({
        ...baseUser,
        passwordHash: hashedPassword,
        failedAttempts: 0,
      });
      mockAuthRepository.recordFailedAttempt.mockResolvedValue({
        ...baseUser,
        failedAttempts: 1,
      });

      const result = await service.validateLocalUser('test@example.com', 'WrongP@ss123');
      expect(result).toBeNull();
      expect(mockAuthRepository.recordFailedAttempt).toHaveBeenCalledWith(baseUser.id);
    });

    it('should throw ForbiddenException and lock after 5 failed attempts', async () => {
      const hashedPassword = await HashUtil.hash('CorrectP@ss123');
      mockAuthRepository.findUserByEmail.mockResolvedValue({
        ...baseUser,
        passwordHash: hashedPassword,
        failedAttempts: 4,
      });
      mockAuthRepository.recordFailedAttempt.mockResolvedValue({
        ...baseUser,
        failedAttempts: 5,
      });
      mockAuthRepository.lockAccount.mockResolvedValue(undefined);

      await expect(
        service.validateLocalUser('test@example.com', 'WrongP@ss123'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockAuthRepository.lockAccount).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if account is locked', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue({
        ...baseUser,
        lockoutUntil: new Date(Date.now() + 10 * 60 * 1000), // locked for 10 minutes
      });

      await expect(
        service.validateLocalUser('test@example.com', 'password'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for OAuth-only account', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue({
        ...baseUser,
        passwordHash: null,
      });

      await expect(
        service.validateLocalUser('test@example.com', 'password'),
      ).rejects.toThrow(expect.objectContaining({ message: expect.stringContaining('social login') }));
    });
  });

  // ─── changePassword() ─────────────────────────────────────────────────────

  describe('changePassword()', () => {
    it('should update password if current password is correct', async () => {
      const hashedPassword = await HashUtil.hash('OldP@ss123');
      mockAuthRepository.findUserByIdRaw.mockResolvedValue({
        ...baseUser,
        passwordHash: hashedPassword,
      });
      mockAuthRepository.updatePassword.mockResolvedValue(undefined);
      mockAuthRepository.revokeAllUserRefreshTokens.mockResolvedValue(undefined);

      await expect(
        service.changePassword(baseUser.id, 'OldP@ss123', 'NewStrongP@ss123'),
      ).resolves.not.toThrow();

      expect(mockAuthRepository.updatePassword).toHaveBeenCalledWith(
        baseUser.id,
        expect.any(String),
      );
      expect(mockAuthRepository.revokeAllUserRefreshTokens).toHaveBeenCalledWith(baseUser.id);
    });

    it('should throw UnauthorizedException for wrong current password', async () => {
      const hashedPassword = await HashUtil.hash('CorrectP@ss123');
      mockAuthRepository.findUserByIdRaw.mockResolvedValue({
        ...baseUser,
        passwordHash: hashedPassword,
      });

      await expect(
        service.changePassword(baseUser.id, 'WrongP@ss123', 'NewP@ss123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockAuthRepository.findUserByIdRaw.mockResolvedValue(null);

      await expect(
        service.changePassword('nonexistent-id', 'old', 'new'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── logout() ─────────────────────────────────────────────────────────────

  describe('logout()', () => {
    it('should revoke a valid refresh token', async () => {
      mockAuthRepository.findRefreshToken.mockResolvedValue({ id: 'token-id', userId: baseUser.id });
      mockAuthRepository.revokeRefreshToken.mockResolvedValue(undefined);

      await service.logout(baseUser.id, 'some-refresh-token');

      expect(mockAuthRepository.revokeRefreshToken).toHaveBeenCalledWith('token-id');
    });

    it('should not throw if token not found (idempotent logout)', async () => {
      mockAuthRepository.findRefreshToken.mockResolvedValue(null);

      await expect(service.logout(baseUser.id, 'unknown-token')).resolves.not.toThrow();
    });
  });

  // ─── validateOrCreateGoogleUser() ─────────────────────────────────────────

  describe('validateOrCreateGoogleUser()', () => {
    const googleUser = {
      googleId: 'google-123',
      email: 'google@example.com',
      firstName: 'Google',
      lastName: 'User',
    };

    it('should return existing user if email already registered', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue(baseUser);

      const result = await service.validateOrCreateGoogleUser(googleUser);

      expect(result.id).toBe(baseUser.id);
      expect(mockAuthRepository.createUser).not.toHaveBeenCalled();
    });

    it('should create new user and mark email verified for new Google accounts', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue(null);
      mockAuthRepository.createUser.mockResolvedValue({
        ...baseUser,
        email: googleUser.email,
      });
      mockAuthRepository.markEmailVerified.mockResolvedValue(undefined);

      const result = await service.validateOrCreateGoogleUser(googleUser);

      expect(mockAuthRepository.createUser).toHaveBeenCalled();
      expect(mockAuthRepository.markEmailVerified).toHaveBeenCalledWith(baseUser.id);
      expect(result).toHaveProperty('id');
    });
  });
});
