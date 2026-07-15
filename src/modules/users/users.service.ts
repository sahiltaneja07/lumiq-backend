import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { UsersRepository, UserWithProfile } from './users.repository';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { AuthRepository } from '../auth/auth.repository';
import { HashUtil } from '../../common/utils/hash.util';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly authRepository: AuthRepository,
  ) {}

  // ─── Get Current User ──────────────────────────────────────────────────────

  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toResponseDto(user);
  }

  // ─── Update Profile ───────────────────────────────────────────────────────

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserResponseDto> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.usersRepository.updateProfile(userId, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      phoneNumber: dto.phoneNumber,
      avatarUrl: dto.avatarUrl,
      bio: dto.bio,
    });

    await this.authRepository.createAuditLog({
      action: 'PROFILE_UPDATED',
      entityName: 'UserProfile',
      entityId: userId,
      userId,
    });

    this.logger.log(`Profile updated for user: ${userId}`);
    const updated = await this.usersRepository.findById(userId);
    return this.toResponseDto(updated!);
  }

  // ─── Upload Avatar ────────────────────────────────────────────────────────

  /**
   * Upload profile image to S3 and update profile.
   * S3 upload is delegated to StorageService (Phase 2).
   * For Phase 1 this accepts a pre-signed URL or existing URL.
   */
  async updateAvatar(userId: string, avatarUrl: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.usersRepository.updateAvatarUrl(userId, avatarUrl);

    this.logger.log(`Avatar updated for user: ${userId}`);
    const updated = await this.usersRepository.findById(userId);
    return this.toResponseDto(updated!);
  }

  // ─── Deactivate Account ───────────────────────────────────────────────────

  async deactivateAccount(userId: string): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.usersRepository.softDeactivate(userId);
    await this.authRepository.revokeAllUserRefreshTokens(userId);

    await this.authRepository.createAuditLog({
      action: 'ACCOUNT_DEACTIVATED',
      entityName: 'User',
      entityId: userId,
      userId,
    });

    this.logger.log(`Account deactivated: ${userId}`);
  }

  // ─── Delete Account ───────────────────────────────────────────────────────

  async deleteAccount(userId: string, password?: string): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If user has a password, require confirmation
    if (user.passwordHash && password) {
      const isValid = await HashUtil.compare(password, user.passwordHash);
      if (!isValid) {
        throw new BadRequestException('Password confirmation is incorrect');
      }
    }

    await this.authRepository.revokeAllUserRefreshTokens(userId);
    await this.usersRepository.hardDelete(userId);

    await this.authRepository.createAuditLog({
      action: 'ACCOUNT_DELETED',
      entityName: 'User',
      entityId: userId,
      userId,
    });

    this.logger.log(`Account hard-deleted: ${userId}`);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  toResponseDto(user: UserWithProfile): UserResponseDto {
    return plainToInstance(
      UserResponseDto,
      {
        id: user.id,
        email: user.email,
        roles: user.roles,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        profile: user.profile,
        isSuspended: user.lockoutUntil ? user.lockoutUntil > new Date() : false,
      },
      { excludeExtraneousValues: true },
    );
  }
}
