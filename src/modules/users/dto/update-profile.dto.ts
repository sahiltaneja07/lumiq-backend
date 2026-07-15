import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John', description: 'First name' })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe', description: 'Last name' })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: '+447911123456', description: 'E.164 formatted phone number' })
  @IsPhoneNumber(undefined, { message: 'Phone number must be in E.164 format, e.g. +447911123456' })
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg', description: 'Profile photo URL' })
  @IsUrl()
  @IsOptional()
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'EV enthusiast and daily commuter', description: 'Short bio (max 500 chars)' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  bio?: string;
}
