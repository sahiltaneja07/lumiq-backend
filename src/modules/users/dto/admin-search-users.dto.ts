import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { Role } from '../../../common/enums/role.enum';

export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  UNVERIFIED = 'unverified',
  DELETED = 'deleted',
}

export class AdminSearchUsersDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Role, description: 'Filter by user role' })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({
    enum: UserStatus,
    description: 'Filter by account status',
  })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;
}
