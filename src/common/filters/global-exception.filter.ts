import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ERROR_CODES } from '../constants';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = ERROR_CODES.INTERNAL_SERVER_ERROR;
    let errors: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message = (exceptionResponse as any).message || exception.message;
        errors = (exceptionResponse as any).errors || (exceptionResponse as any).message || null;
      }

      // Map HTTP status to custom error codes
      if (status === HttpStatus.UNAUTHORIZED) {
        code = ERROR_CODES.UNAUTHORIZED;
      } else if (status === HttpStatus.FORBIDDEN) {
        code = ERROR_CODES.FORBIDDEN;
      } else if (status === HttpStatus.NOT_FOUND) {
        code = ERROR_CODES.NOT_FOUND;
      } else if (status === HttpStatus.BAD_REQUEST) {
        code = ERROR_CODES.BAD_REQUEST;
      } else if (status === HttpStatus.CONFLICT) {
        code = ERROR_CODES.CONFLICT;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(`Unhandled Exception: ${exception.message}`, exception.stack);
    } else {
      this.logger.error(`Unknown Exception: ${JSON.stringify(exception)}`);
    }

    const payload = {
      success: false,
      message,
      code,
      errors,
      meta: {
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    response.status(status).json(payload);
  }
}
