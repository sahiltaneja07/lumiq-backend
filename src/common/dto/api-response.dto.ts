import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseDto<T> {
  @ApiProperty()
  success: boolean;

  @ApiProperty({ required: false })
  message?: string;

  data?: T;

  @ApiProperty({ required: false })
  errors?: any;

  @ApiProperty({
    required: false,
    example: {
      page: 1,
      limit: 10,
      totalItems: 50,
      totalPages: 5,
    },
  })
  meta?: {
    page?: number;
    limit?: number;
    totalItems?: number;
    totalPages?: number;
    [key: string]: any;
  };
}
