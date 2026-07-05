import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected successfully via Prisma');
    
    // Bind query logs
    (this as any).$on('query', (e: any) => {
      this.logger.debug(`Query: ${e.query} - Params: ${e.params} - Duration: ${e.duration}ms`);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected successfully via Prisma');
  }

  // Soft delete wrapper helper
  async softDelete(model: string, id: string, updatedBy?: string) {
    const db = this as any;
    if (!db[model]) {
      throw new Error(`Model ${model} does not exist on PrismaClient`);
    }
    return db[model].update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy: updatedBy || null,
      },
    });
  }
}
