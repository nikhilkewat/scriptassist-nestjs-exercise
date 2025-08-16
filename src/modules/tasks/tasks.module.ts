import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { Task } from './entities/task.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task]),
    // Queue module - only load if Redis is enabled
    ...(process.env.REDIS_ENABLED !== 'false' ? [
      require('@nestjs/bullmq').BullModule.registerQueue({
        name: 'task-processing',
      }),
    ] : []),
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {} 