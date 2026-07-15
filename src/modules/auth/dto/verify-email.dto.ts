import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Email verification token sent to the registered email address',
    example: 'a3f8e2d1c4b5a6e7f8d9...',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}
