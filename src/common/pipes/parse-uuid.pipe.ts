import {
  BadRequestException,
  Injectable,
  ParseUUIDPipe as NestParseUUIDPipe,
} from '@nestjs/common';

@Injectable()
export class ParseUUIDPipe extends NestParseUUIDPipe {
  constructor() {
    super({
      exceptionFactory: () => {
        return new BadRequestException('Validation failed (valid uuid v4 expected)');
      },
    });
  }
}
