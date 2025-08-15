import { ApiProperty } from '@nestjs/swagger';
import { Task } from '../entities/task.entity';

export class PaginatedTasksDto {
  @ApiProperty({ type: [Task], description: 'Array of tasks' })
  data: Task[];

  @ApiProperty({ description: 'Total number of tasks matching the query' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Whether there is a next page' })
  hasNext: boolean;

  @ApiProperty({ description: 'Whether there is a previous page' })
  hasPrev: boolean;
}
