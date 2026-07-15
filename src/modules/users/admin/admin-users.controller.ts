import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Role } from '../../../common/enums/role.enum';
import { AdminUsersService } from './admin-users.service';
import { AdminSearchUsersDto } from '../dto/admin-search-users.dto';
import { UserResponseDto } from '../dto/user-response.dto';

@ApiTags('Admin — Users')
@ApiBearerAuth('JWT-auth')
@Roles(Role.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  // ─── GET /admin/users ──────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: '[ADMIN] List all users with filtering, search, and pagination',
    description: 'Returns a paginated list of all users. Supports search by name/email, filter by role and status.',
  })
  @ApiResponse({ status: 200, description: 'Paginated user list', type: UserResponseDto, isArray: true })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required.' })
  async listUsers(
    @Query() query: AdminSearchUsersDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminUsersService.listUsers(query, adminId);
  }

  // ─── GET /admin/users/:id ─────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: '[ADMIN] Get a single user by ID' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User details', type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async getUserById(
    @Param('id', ParseUUIDPipe) userId: string,
  ): Promise<UserResponseDto> {
    return this.adminUsersService.getUserById(userId);
  }

  // ─── PATCH /admin/users/:id/suspend ───────────────────────────────────────

  @Patch(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[ADMIN] Suspend a user account',
    description: 'Suspends the user for 30 days and revokes all their refresh tokens.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User suspended successfully.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async suspendUser(
    @Param('id', ParseUUIDPipe) userId: string,
    @CurrentUser('id') adminId: string,
  ) {
    await this.adminUsersService.suspendUser(userId, adminId);
    return { message: 'User suspended successfully' };
  }

  // ─── PATCH /admin/users/:id/activate ─────────────────────────────────────

  @Patch(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[ADMIN] Activate or reinstate a suspended user',
    description: 'Clears the lockout and resets failed login attempts.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User activated successfully.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async activateUser(
    @Param('id', ParseUUIDPipe) userId: string,
    @CurrentUser('id') adminId: string,
  ) {
    await this.adminUsersService.activateUser(userId, adminId);
    return { message: 'User activated successfully' };
  }

  // ─── DELETE /admin/users/:id ──────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[ADMIN] Soft-delete a user account',
    description: 'Marks user as deleted and revokes all sessions. Data is preserved for compliance.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User deleted successfully.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async deleteUser(
    @Param('id', ParseUUIDPipe) userId: string,
    @CurrentUser('id') adminId: string,
  ) {
    await this.adminUsersService.deleteUser(userId, adminId);
    return { message: 'User deleted successfully' };
  }
}
