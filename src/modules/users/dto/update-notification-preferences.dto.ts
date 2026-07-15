import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({ description: 'Receive booking confirmation emails' })
  @IsBoolean()
  @IsOptional()
  emailBookingConfirmed?: boolean;

  @ApiPropertyOptional({ description: 'Receive payment notification emails' })
  @IsBoolean()
  @IsOptional()
  emailPayment?: boolean;

  @ApiPropertyOptional({ description: 'Receive promotional emails' })
  @IsBoolean()
  @IsOptional()
  emailPromotions?: boolean;

  @ApiPropertyOptional({ description: 'Receive booking push notifications' })
  @IsBoolean()
  @IsOptional()
  pushBooking?: boolean;

  @ApiPropertyOptional({ description: 'Receive chat message push notifications' })
  @IsBoolean()
  @IsOptional()
  pushMessages?: boolean;

  @ApiPropertyOptional({ description: 'Receive SMS for booking updates' })
  @IsBoolean()
  @IsOptional()
  smsBooking?: boolean;
}
