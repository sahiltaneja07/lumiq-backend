import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { User, UserProfile } from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import { UserStatus } from './dto/admin-search-users.dto';

export type UserWithProfile = User & { profile: UserProfile | null };

@Injectable()
export class UsersRepository {
  private readonly logger = new Logger(UsersRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Single User Queries ──────────────────────────────────────────────────

  async findById(id: string): Promise<UserWithProfile | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { profile: true },
    });
  }

  async findByEmail(email: string): Promise<UserWithProfile | null> {
    return this.prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), deletedAt: null },
      include: { profile: true },
    });
  }

  // ─── Profile Updates ──────────────────────────────────────────────────────

  async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
      avatarUrl?: string;
      bio?: string;
    },
  ): Promise<UserProfile> {
    return this.prisma.userProfile.upsert({
      where: { userId },
      update: {
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
        ...(data.bio !== undefined && { bio: data.bio }),
      },
      create: {
        userId,
        firstName: data.firstName ?? '',
        lastName: data.lastName ?? '',
        phoneNumber: data.phoneNumber,
        avatarUrl: data.avatarUrl,
        bio: data.bio,
      },
    });
  }

  async updateAvatarUrl(userId: string, avatarUrl: string): Promise<void> {
    await this.prisma.userProfile.update({
      where: { userId },
      data: { avatarUrl },
    });
  }

  // ─── Account Actions ──────────────────────────────────────────────────────

  async softDeactivate(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });
  }

  async hardDelete(userId: string): Promise<void> {
    await this.prisma.user.delete({ where: { id: userId } });
  }

  // ─── Admin User Queries ───────────────────────────────────────────────────

  async findManyWithFilters(params: {
    page: number;
    limit: number;
    search?: string;
    role?: Role;
    status?: UserStatus;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ users: UserWithProfile[]; total: number }> {
    const { page, limit, search, role, status, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { profile: { firstName: { contains: search, mode: 'insensitive' } } },
        { profile: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (role) {
      where.roles = { has: role };
    }

    if (status === UserStatus.ACTIVE) {
      where.deletedAt = null;
      where.lockoutUntil = null;
    } else if (status === UserStatus.SUSPENDED) {
      where.deletedAt = null;
      where.lockoutUntil = { gt: new Date() };
    } else if (status === UserStatus.UNVERIFIED) {
      where.deletedAt = null;
      where.isEmailVerified = false;
    } else if (status === UserStatus.DELETED) {
      where.deletedAt = { not: null };
    } else {
      // Default: non-deleted only
      where.deletedAt = null;
    }

    const allowedSortFields = ['createdAt', 'email', 'updatedAt'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: { profile: true },
        skip,
        take: limit,
        orderBy: { [safeSortBy]: sortOrder },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users: users as UserWithProfile[], total };
  }

  async suspend(userId: string, durationMinutes: number = 60 * 24 * 30): Promise<void> {
    const lockoutUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
    await this.prisma.user.update({
      where: { id: userId },
      data: { lockoutUntil },
    });
  }

  async activate(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lockoutUntil: null, failedAttempts: 0 },
    });
  }

  async adminDelete(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });
  }
}
