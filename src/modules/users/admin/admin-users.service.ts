import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { UsersRepository } from '../users.repository';
import { AuthRepository } from '../../auth/auth.repository';
import { UserResponseDto } from '../dto/user-response.dto';
import { AdminSearchUsersDto } from '../dto/admin-search-users.dto';
import { Role } from '../../../common/enums/role.enum';

export interface PaginatedUsersResult {
  data: UserResponseDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly authRepository: AuthRepository,
  ) {}

  // ─── List Users ───────────────────────────────────────────────────────────

  async listUsers(
    query: AdminSearchUsersDto,
    adminId: string,
  ): Promise<PaginatedUsersResult> {
    const { page = 1, limit = 10, search, role, status, sortBy, sortOrder } = query;

    const { users, total } = await this.usersRepository.findManyWithFilters({
      page,
      limit,
      search,
      role,
      status,
      sortBy,
      sortOrder,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: users.map((u) =>
        plainToInstance(
          UserResponseDto,
          {
            id: u.id,
            email: u.email,
            roles: u.roles,
            isEmailVerified: u.isEmailVerified,
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
            profile: u.profile,
            isSuspended: u.lockoutUntil ? u.lockoutUntil > new Date() : false,
          },
          { excludeExtraneousValues: true },
        ),
      ),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  // ─── Get User by ID ───────────────────────────────────────────────────────

  async getUserById(userId: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

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

  // ─── Suspend User ─────────────────────────────────────────────────────────

  async suspendUser(targetUserId: string, adminId: string): Promise<void> {
    const user = await this.usersRepository.findById(targetUserId);
    if (!user) {
      throw new NotFoundException(`User ${targetUserId} not found`);
    }

    // Suspend for 30 days by default
    await this.usersRepository.suspend(targetUserId, 60 * 24 * 30);
    await this.authRepository.revokeAllUserRefreshTokens(targetUserId);

    await this.authRepository.createAuditLog({
      action: 'ADMIN_USER_SUSPENDED',
      entityName: 'User',
      entityId: targetUserId,
      userId: adminId,
    });

    this.logger.log(`User ${targetUserId} suspended by admin ${adminId}`);
  }

  // ─── Activate User ────────────────────────────────────────────────────────

  async activateUser(targetUserId: string, adminId: string): Promise<void> {
    const user = await this.usersRepository.findById(targetUserId);
    if (!user) {
      throw new NotFoundException(`User ${targetUserId} not found`);
    }

    await this.usersRepository.activate(targetUserId);

    await this.authRepository.createAuditLog({
      action: 'ADMIN_USER_ACTIVATED',
      entityName: 'User',
      entityId: targetUserId,
      userId: adminId,
    });

    this.logger.log(`User ${targetUserId} activated by admin ${adminId}`);
  }

  // ─── Delete User ──────────────────────────────────────────────────────────

  async deleteUser(targetUserId: string, adminId: string): Promise<void> {
    const user = await this.usersRepository.findById(targetUserId);
    if (!user) {
      throw new NotFoundException(`User ${targetUserId} not found`);
    }

    await this.authRepository.revokeAllUserRefreshTokens(targetUserId);
    await this.usersRepository.adminDelete(targetUserId);

    await this.authRepository.createAuditLog({
      action: 'ADMIN_USER_DELETED',
      entityName: 'User',
      entityId: targetUserId,
      userId: adminId,
    });

    this.logger.log(`User ${targetUserId} deleted by admin ${adminId}`);
  }
}
