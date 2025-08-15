import { ApiProperty } from '@nestjs/swagger';

export class TaskStatsDto {
  @ApiProperty({ description: 'Total number of tasks' })
  total: number;

  @ApiProperty({ description: 'Number of completed tasks' })
  completed: number;

  @ApiProperty({ description: 'Number of tasks in progress' })
  inProgress: number;

  @ApiProperty({ description: 'Number of pending tasks' })
  pending: number;

  @ApiProperty({ description: 'Number of high priority tasks' })
  highPriority: number;

  @ApiProperty({ description: 'Number of medium priority tasks' })
  mediumPriority: number;

  @ApiProperty({ description: 'Number of low priority tasks' })
  lowPriority: number;

  @ApiProperty({ description: 'Number of overdue tasks' })
  overdue: number;

  @ApiProperty({ description: 'Completion rate percentage' })
  completionRate: number;
}
