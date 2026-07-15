import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';

import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { AdminUsersService } from './admin/admin-users.service';
import { AdminUsersController } from './admin/admin-users.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule, // Re-exports AuthRepository
  ],
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService, UsersRepository, AdminUsersService],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
