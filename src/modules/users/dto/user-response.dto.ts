import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { Role } from '../../../common/enums/role.enum';

export class UserProfileResponseDto {
  @ApiProperty() @Expose() id: string;
  @ApiProperty() @Expose() firstName: string;
  @ApiProperty() @Expose() lastName: string;
  @ApiPropertyOptional() @Expose() phoneNumber?: string | null;
  @ApiPropertyOptional() @Expose() avatarUrl?: string | null;
  @ApiPropertyOptional() @Expose() bio?: string | null;
  @ApiProperty() @Expose() createdAt: Date;
  @ApiProperty() @Expose() updatedAt: Date;
}

export class UserResponseDto {
  @ApiProperty({ description: 'User UUID' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @Expose()
  email: string;

  @ApiProperty({ enum: Role, isArray: true })
  @Expose()
  roles: Role[];

  @ApiProperty()
  @Expose()
  isEmailVerified: boolean;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  @ApiPropertyOptional({ type: () => UserProfileResponseDto })
  @Expose()
  @Type(() => UserProfileResponseDto)
  profile?: UserProfileResponseDto | null;

  @ApiPropertyOptional({ description: 'Whether the user is currently suspended' })
  @Expose()
  isSuspended?: boolean;

  // Sensitive fields — never exposed in responses
  @Exclude() passwordHash?: string;
  @Exclude() failedAttempts?: number;
  @Exclude() lockoutUntil?: Date | null;
  @Exclude() deletedAt?: Date | null;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
