import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { AuthRepository } from '../auth/auth.repository';
import { Role } from '../../common/enums/role.enum';
import { UpdateProfileDto } from './dto/update-profile.dto';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockUsersRepository = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  updateProfile: jest.fn(),
  updateAvatarUrl: jest.fn(),
  softDeactivate: jest.fn(),
  hardDelete: jest.fn(),
};

const mockAuthRepository = {
  revokeAllUserRefreshTokens: jest.fn(),
  createAuditLog: jest.fn(),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('UsersService', () => {
  let service: UsersService;

  const baseUser = {
    id: 'user-uuid-1',
    email: 'john@example.com',
    passwordHash: '$2b$10$hashedpassword',
    roles: [Role.DRIVER],
    isEmailVerified: true,
    failedAttempts: 0,
    lockoutUntil: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: {
      id: 'profile-uuid-1',
      userId: 'user-uuid-1',
      firstName: 'John',
      lastName: 'Doe',
      phoneNumber: null,
      avatarUrl: null,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: mockUsersRepository },
        { provide: AuthRepository, useValue: mockAuthRepository },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
    mockAuthRepository.createAuditLog.mockResolvedValue(undefined);
  });

  // ─── getCurrentUser() ──────────────────────────────────────────────────────

  describe('getCurrentUser()', () => {
    it('should return user response DTO without sensitive fields', async () => {
      mockUsersRepository.findById.mockResolvedValue(baseUser);

      const result = await service.getCurrentUser(baseUser.id);

      expect(result).toHaveProperty('id', baseUser.id);
      expect(result).toHaveProperty('email', baseUser.email);
      expect(result).toHaveProperty('roles');
      expect(result.passwordHash).toBeUndefined();
      expect(result.failedAttempts).toBeUndefined();
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockUsersRepository.findById.mockResolvedValue(null);

      await expect(service.getCurrentUser('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateProfile() ──────────────────────────────────────────────────────

  describe('updateProfile()', () => {
    it('should update profile and return updated DTO', async () => {
      const dto: UpdateProfileDto = { firstName: 'Jane', bio: 'EV enthusiast' };
      const updatedUser = {
        ...baseUser,
        profile: { ...baseUser.profile, firstName: 'Jane', bio: 'EV enthusiast' },
      };

      mockUsersRepository.findById
        .mockResolvedValueOnce(baseUser) // initial check
        .mockResolvedValueOnce(updatedUser); // after update
      mockUsersRepository.updateProfile.mockResolvedValue(updatedUser.profile);

      const result = await service.updateProfile(baseUser.id, dto);

      expect(mockUsersRepository.updateProfile).toHaveBeenCalledWith(
        baseUser.id,
        expect.objectContaining({ firstName: 'Jane', bio: 'EV enthusiast' }),
      );
      expect(result).toHaveProperty('id', baseUser.id);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockUsersRepository.findById.mockResolvedValue(null);

      await expect(service.updateProfile('nonexistent-id', {})).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deactivateAccount() ──────────────────────────────────────────────────

  describe('deactivateAccount()', () => {
    it('should soft delete user and revoke all tokens', async () => {
      mockUsersRepository.findById.mockResolvedValue(baseUser);
      mockUsersRepository.softDeactivate.mockResolvedValue(undefined);
      mockAuthRepository.revokeAllUserRefreshTokens.mockResolvedValue(undefined);

      await service.deactivateAccount(baseUser.id);

      expect(mockUsersRepository.softDeactivate).toHaveBeenCalledWith(baseUser.id);
      expect(mockAuthRepository.revokeAllUserRefreshTokens).toHaveBeenCalledWith(baseUser.id);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockUsersRepository.findById.mockResolvedValue(null);

      await expect(service.deactivateAccount('unknown-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deleteAccount() ──────────────────────────────────────────────────────

  describe('deleteAccount()', () => {
    it('should hard delete user and revoke tokens', async () => {
      mockUsersRepository.findById.mockResolvedValue(baseUser);
      mockUsersRepository.hardDelete.mockResolvedValue(undefined);
      mockAuthRepository.revokeAllUserRefreshTokens.mockResolvedValue(undefined);

      await service.deleteAccount(baseUser.id);

      expect(mockUsersRepository.hardDelete).toHaveBeenCalledWith(baseUser.id);
      expect(mockAuthRepository.revokeAllUserRefreshTokens).toHaveBeenCalledWith(baseUser.id);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockUsersRepository.findById.mockResolvedValue(null);

      await expect(service.deleteAccount('unknown-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateAvatar() ───────────────────────────────────────────────────────

  describe('updateAvatar()', () => {
    it('should update avatar URL and return updated DTO', async () => {
      const avatarUrl = 'https://s3.amazonaws.com/lumiq/avatars/user-uuid-1/avatar.jpg';
      const updatedUser = {
        ...baseUser,
        profile: { ...baseUser.profile, avatarUrl },
      };

      mockUsersRepository.findById
        .mockResolvedValueOnce(baseUser)
        .mockResolvedValueOnce(updatedUser);
      mockUsersRepository.updateAvatarUrl.mockResolvedValue(undefined);

      const result = await service.updateAvatar(baseUser.id, avatarUrl);

      expect(mockUsersRepository.updateAvatarUrl).toHaveBeenCalledWith(baseUser.id, avatarUrl);
      expect(result).toHaveProperty('id', baseUser.id);
    });
  });
});
