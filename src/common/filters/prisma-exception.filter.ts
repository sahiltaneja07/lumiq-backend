import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { ERROR_CODES } from '../constants';

@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientValidationError,
  Prisma.PrismaClientUnknownRequestError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientValidationError
      | Prisma.PrismaClientUnknownRequestError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Database operation failed';
    let code = ERROR_CODES.DATABASE_ERROR;
    let errors: any = null;

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.warn(`Prisma Known Error: ${exception.code} - ${exception.message}`);
      switch (exception.code) {
        case 'P2002': // Unique constraint failed
          status = HttpStatus.CONFLICT;
          const fields = (exception.meta?.target as string[]) || [];
          message = `Resource already exists with field: ${fields.join(', ')}`;
          code = ERROR_CODES.RESOURCE_EXISTS;
          break;
        case 'P2025': // Record not found
          status = HttpStatus.NOT_FOUND;
          message = exception.meta?.cause as string || 'Record not found';
          code = ERROR_CODES.NOT_FOUND;
          break;
        case 'P2003': // Foreign key constraint failed
          status = HttpStatus.BAD_REQUEST;
          message = `Relation constraint failed: ${exception.meta?.field_name as string || ''}`;
          code = ERROR_CODES.BAD_REQUEST;
          break;
        default:
          message = `Database query error: ${exception.code}`;
          break;
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Database validation failed';
      code = ERROR_CODES.VALIDATION_ERROR;
      errors = exception.message;
      this.logger.warn(`Prisma Validation Error: ${exception.message}`);
    } else {
      message = 'Unknown database error occurred';
      this.logger.error('Unhandled Prisma Error', exception);
    }

    response.status(status).json({
      success: false,
      message,
      code,
      errors,
      meta: {
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }
}
