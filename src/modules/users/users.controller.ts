import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';

@ApiTags('Users — Profile')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── GET /users/me ────────────────────────────────────────────────────────

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile', type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorised.' })
  async getCurrentUser(@CurrentUser('id') userId: string): Promise<UserResponseDto> {
    return this.usersService.getCurrentUser(userId);
  }

  // ─── PATCH /users/me ──────────────────────────────────────────────────────

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update current user profile fields' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully', type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Validation errors.' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateProfile(userId, dto);
  }

  // ─── POST /users/me/avatar ────────────────────────────────────────────────

  @Post('me/avatar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload profile avatar image',
    description:
      'Accepts a multipart/form-data image upload. File is stored in AWS S3 (Phase 2 full integration). ' +
      'In Phase 1 the file object is received and a stub URL is returned.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Profile image (JPEG, PNG, WebP max 5MB)' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 200, description: 'Avatar updated successfully', type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid file type or size.' })
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UserResponseDto> {
    if (!file) {
      throw new Error('No file uploaded');
    }

    // Phase 2: Replace with real S3 upload via StorageService
    // const avatarUrl = await this.storageService.uploadUserAvatar(userId, file);
    const stubAvatarUrl = `https://lumiq-storage.s3.amazonaws.com/avatars/${userId}/${Date.now()}-${file.originalname}`;

    return this.usersService.updateAvatar(userId, stubAvatarUrl);
  }

  // ─── DELETE /users/me/deactivate ──────────────────────────────────────────

  @Delete('me/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate (soft delete) current user account',
    description: 'Account is marked as deactivated. All refresh tokens are revoked. Account can be reactivated by an admin.',
  })
  @ApiResponse({ status: 200, description: 'Account deactivated successfully.' })
  async deactivateAccount(@CurrentUser('id') userId: string) {
    await this.usersService.deactivateAccount(userId);
    return { message: 'Account has been deactivated successfully' };
  }

  // ─── DELETE /users/me ─────────────────────────────────────────────────────

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Permanently delete current user account',
    description: 'Hard deletes the account and all associated data. This action is irreversible.',
  })
  @ApiParam({ name: 'confirmPassword', required: false, description: 'Required for password-based accounts' })
  @ApiResponse({ status: 200, description: 'Account deleted permanently.' })
  async deleteAccount(
    @CurrentUser('id') userId: string,
    @Body('confirmPassword') confirmPassword?: string,
  ) {
    await this.usersService.deleteAccount(userId, confirmPassword);
    return { message: 'Account has been permanently deleted' };
  }
}
