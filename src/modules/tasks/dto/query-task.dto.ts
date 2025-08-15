import { IsEnum, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { TaskStatus } from '../enums/task-status.enum';
import { TaskPriority } from '../enums/task-priority.enum';

export class QueryTaskDto {
  @ApiProperty({ required: false, description: 'Filter by task status' })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({ required: false, description: 'Filter by task priority' })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiProperty({ required: false, description: 'Filter by user ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ required: false, description: 'Search in title and description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, description: 'Filter by due date (ISO string)' })
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiProperty({ required: false, description: 'Sort field', example: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiProperty({ required: false, description: 'Sort order', example: 'DESC', enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toUpperCase())
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @ApiProperty({ required: false, description: 'Page number', minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, description: 'Items per page', minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  @Min(1)
  limit?: number = 10;
}
