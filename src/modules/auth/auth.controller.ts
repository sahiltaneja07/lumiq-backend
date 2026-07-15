import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Optional,
  Post,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import type { IRedisClient } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Optional() @Inject('REDIS_CLIENT') private readonly redisClient?: IRedisClient,
  ) {}

  // ─── Register ─────────────────────────────────────────────────────────────

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account (Driver or Host)' })
  @ApiResponse({ status: 201, description: 'Account created successfully. Returns JWT tokens.' })
  @ApiResponse({ status: 409, description: 'Email already registered.' })
  @ApiResponse({ status: 400, description: 'Validation errors.' })
  async register(@Body() dto: RegisterDto, @Req() req: any) {
    const result = await this.authService.register(dto, this.redisClient);
    return {
      message: 'Registration successful. Please verify your email.',
      user: {
        id: result.user.id,
        email: result.user.email,
        roles: result.user.roles,
        isEmailVerified: result.user.isEmailVerified,
        profile: result.user.profile,
      },
      tokens: result.tokens,
    };
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('local'))
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful. Returns JWT tokens.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 403, description: 'Account is locked.' })
  async login(@Req() req: any) {
    const user = req.user as { id: string; email: string; roles: Role[] };
    const tokens = await this.authService.login(
      user,
      req.ip,
      req.headers['user-agent'],
    );
    return {
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
      },
      tokens,
    };
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully.' })
  async logout(
    @CurrentUser('id') userId: string,
    @Body() dto: LogoutDto,
  ) {
    await this.authService.logout(userId, dto.refreshToken);
    return { message: 'Logged out successfully' };
  }

  // ─── Refresh Token ────────────────────────────────────────────────────────

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt-refresh'))
  @ApiOperation({ summary: 'Rotate refresh token and issue new access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'New tokens issued.' })
  @ApiResponse({ status: 401, description: 'Refresh token invalid or expired.' })
  async refresh(@Req() req: any) {
    const { id, email, roles, tokenId } = req.user as {
      id: string;
      email: string;
      roles: Role[];
      tokenId: string;
    };
    const tokens = await this.authService.refreshTokens(id, email, roles, tokenId);
    return { message: 'Tokens refreshed', tokens };
  }

  // ─── Email Verification ───────────────────────────────────────────────────

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address using token from email link' })
  @ApiResponse({ status: 200, description: 'Email verified successfully.' })
  @ApiResponse({ status: 400, description: 'Token invalid or expired.' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    if (!this.redisClient) {
      return { message: 'Email verification service not available' };
    }
    await this.authService.verifyEmail(dto.token, this.redisClient);
    return { message: 'Email verified successfully' };
  }

  // ─── Forgot Password ──────────────────────────────────────────────────────

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({
    status: 200,
    description: 'If the email exists, a reset link has been sent.',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    if (this.redisClient) {
      await this.authService.forgotPassword(dto.email, this.redisClient);
    }
    // Always return same response to prevent email enumeration
    return {
      message: 'If an account with that email exists, a reset link has been sent.',
    };
  }

  // ─── Reset Password ───────────────────────────────────────────────────────

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using the token from email' })
  @ApiResponse({ status: 200, description: 'Password reset successfully.' })
  @ApiResponse({ status: 400, description: 'Token invalid or expired.' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    if (!this.redisClient) {
      return { message: 'Password reset service not available' };
    }
    await this.authService.resetPassword(dto.token, dto.newPassword, this.redisClient);
    return { message: 'Password has been reset successfully. Please log in again.' };
  }

  // ─── Change Password ──────────────────────────────────────────────────────

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Change password while authenticated' })
  @ApiResponse({ status: 200, description: 'Password changed successfully.' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect.' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(userId, dto.currentPassword, dto.newPassword);
    return { message: 'Password changed successfully. Please log in again.' };
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────────

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth2 login flow' })
  @ApiResponse({ status: 302, description: 'Redirects to Google consent screen.' })
  googleAuth() {
    // Guard redirects to Google — no body
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Google OAuth2 callback — issues JWT tokens' })
  @ApiResponse({ status: 200, description: 'Google OAuth successful. Returns JWT tokens.' })
  async googleAuthCallback(@Req() req: any) {
    const user = req.user as { id: string; email: string; roles: Role[] };
    const tokens = await this.authService.login(user, req.ip, req.headers['user-agent']);
    return {
      message: 'Google authentication successful',
      user: { id: user.id, email: user.email, roles: user.roles },
      tokens,
    };
  }
}
