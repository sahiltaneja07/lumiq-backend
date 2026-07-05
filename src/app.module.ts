import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import {
  appConfig,
  dbConfig,
  redisConfig,
  jwtConfig,
  googleConfig,
  stripeConfig,
  awsConfig,
  emailConfig,
  smsConfig,
  mapsConfig,
} from './config/app.config';
import { validate } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { LoggingModule } from './logging/logging.module';

@Module({
  imports: [
    // Configuration Module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        dbConfig,
        redisConfig,
        jwtConfig,
        googleConfig,
        stripeConfig,
        awsConfig,
        emailConfig,
        smsConfig,
        mapsConfig,
      ],
      validate,
    }),

    // Rate Limiting (100 requests per minute per IP)
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Global Database Module
    PrismaModule,

    // Global Structured Logging
    LoggingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global Throttling Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
