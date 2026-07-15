import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email address associated with your account',
  })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;
}
