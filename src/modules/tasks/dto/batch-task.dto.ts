import { IsArray, IsEnum, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '../enums/task-status.enum';

export class BatchTaskDto {
  @ApiProperty({ 
    type: [String], 
    description: 'Array of task IDs to process',
    example: ['123e4567-e89b-12d3-a456-426614174000', '987fcdeb-51a2-43d1-b789-123456789abc']
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsNotEmpty({ each: true })
  taskIds: string[];

  @ApiProperty({ 
    enum: ['complete', 'delete', 'update_status', 'update_priority'],
    description: 'Action to perform on the tasks'
  })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiProperty({ 
    enum: TaskStatus, 
    required: false,
    description: 'New status for update_status action'
  })
  @IsEnum(TaskStatus)
  @IsNotEmpty()
  newStatus?: TaskStatus;

  @ApiProperty({ 
    required: false,
    description: 'New priority for update_priority action'
  })
  @IsString()
  @IsNotEmpty()
  newPriority?: string;
}
