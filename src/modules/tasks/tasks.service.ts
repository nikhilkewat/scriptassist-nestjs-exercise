import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { BatchTaskDto } from './dto/batch-task.dto';
import { PaginatedTasksDto } from './dto/paginated-tasks.dto';
import { TaskStatsDto } from './dto/task-stats.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { TaskStatus } from './enums/task-status.enum';
import { TaskPriority } from './enums/task-priority.enum';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    @InjectQueue('task-processing')
    private taskQueue: Queue | null,
    private dataSource: DataSource,
  ) {}

  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // Create the task
      const task = this.tasksRepository.create(createTaskDto);
      const savedTask = await queryRunner.manager.save(Task, task);

      // Add to queue with proper error handling
      if (this.taskQueue) {
        try {
          await this.taskQueue.add('task-status-update', {
            taskId: savedTask.id,
            status: savedTask.status,
          }, {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          });
        } catch (queueError) {
          this.logger.error(`Failed to add task ${savedTask.id} to queue:`, queueError);
          // Don't fail the transaction for queue errors, just log them
        }
      } else {
        this.logger.warn('Queue not available - task processing will be limited');
      }

      await queryRunner.commitTransaction();
      return savedTask;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to create task:', error);
      throw new BadRequestException('Failed to create task');
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(queryDto: QueryTaskDto): Promise<PaginatedTasksDto> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'DESC' } = queryDto;
    
    // Build efficient query with proper joins and filtering
    const queryBuilder = this.buildTaskQuery(queryDto);
    
    // Get total count for pagination
    const total = await queryBuilder.getCount();
    
    // Apply pagination and sorting
    const offset = (page - 1) * limit;
    const tasks = await queryBuilder
      .orderBy(`task.${sortBy}`, sortOrder)
      .skip(offset)
      .take(limit)
      .getMany();

    const totalPages = Math.ceil(total / limit);
    
    return {
      data: tasks,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    const queryRunner = this.dataSource.createQueryRunner();
        
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // Get task with lock to prevent concurrent updates
      const task = await queryRunner.manager.findOne(Task, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!task) {
        throw new NotFoundException(`Task with ID ${id} not found`);
      }

      const originalStatus = task.status;

      // Update task fields efficiently
      Object.assign(task, updateTaskDto);
      const updatedTask = await queryRunner.manager.save(Task, task);

      // Add to queue if status changed
      if (originalStatus !== updatedTask.status && this.taskQueue) {
        try {
          await this.taskQueue.add('task-status-update', {
            taskId: updatedTask.id,
            status: updatedTask.status,
          }, {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          });
        } catch (queueError) {
          this.logger.error(`Failed to add status update to queue for task ${id}:`, queueError);
        }
      }

      await queryRunner.commitTransaction();
      return updatedTask;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to update task ${id}:`, error);
      throw new BadRequestException('Failed to update task');
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const task = await queryRunner.manager.findOne(Task, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!task) {
        throw new NotFoundException(`Task with ID ${id} not found`);
      }

      await queryRunner.manager.remove(Task, task);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to remove task ${id}:`, error);
      throw new BadRequestException('Failed to remove task');
    } finally {
      await queryRunner.release();
    }
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    return this.tasksRepository.find({
      where: { status },
      relations: ['user'],
    });
  }

  async updateStatus(id: string, status: string): Promise<Task> {
    const task = await this.findOne(id);
    task.status = status as TaskStatus;
    return this.tasksRepository.save(task);
  }

  async getStats(): Promise<TaskStatsDto> {
    // Use efficient SQL aggregation instead of N+1 queries
    const stats = await this.tasksRepository
      .createQueryBuilder('task')
      .select([
        'COUNT(*) as total',
        'COUNT(CASE WHEN task.status = :completed THEN 1 END) as completed',
        'COUNT(CASE WHEN task.status = :inProgress THEN 1 END) as inProgress',
        'COUNT(CASE WHEN task.status = :pending THEN 1 END) as pending',
        'COUNT(CASE WHEN task.priority = :highPriority THEN 1 END) as highPriority',
        'COUNT(CASE WHEN task.priority = :mediumPriority THEN 1 END) as mediumPriority',
        'COUNT(CASE WHEN task.priority = :lowPriority THEN 1 END) as lowPriority',
        'COUNT(CASE WHEN task.dueDate < :now AND task.status != :completed THEN 1 END) as overdue'
      ])
      .setParameters({
        completed: TaskStatus.COMPLETED,
        inProgress: TaskStatus.IN_PROGRESS,
        pending: TaskStatus.PENDING,
        highPriority: TaskPriority.HIGH,
        mediumPriority: TaskPriority.MEDIUM,
        lowPriority: TaskPriority.LOW,
        now: new Date(),
      })
      .getRawOne();

    const total = Number(stats.total) || 0;
    const completed = Number(stats.completed) || 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      inProgress: Number(stats.inProgress) || 0,
      pending: Number(stats.pending) || 0,
      highPriority: Number(stats.highPriority) || 0,
      mediumPriority: Number(stats.mediumPriority) || 0,
      lowPriority: Number(stats.lowPriority) || 0,
      overdue: Number(stats.overdue) || 0,
      completionRate,
    };
  }

  async batchProcess(batchDto: BatchTaskDto): Promise<any[]> {
    const { taskIds, action, newStatus, newPriority } = batchDto;
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const results = [];

      switch (action) {
        case 'complete':
          // Bulk update status to completed
          await queryRunner.manager
            .createQueryBuilder()
            .update(Task)
            .set({ status: TaskStatus.COMPLETED })
            .whereInIds(taskIds)
            .execute();
          
          results.push({ action: 'complete', success: true, affected: taskIds.length });
          break;

        case 'delete':
          // Bulk delete tasks
          await queryRunner.manager
            .createQueryBuilder()
            .delete()
            .from(Task)
            .whereInIds(taskIds)
            .execute();
          
          results.push({ action: 'delete', success: true, affected: taskIds.length });
          break;

        case 'update_status':
          if (!newStatus) {
            throw new BadRequestException('New status is required for update_status action');
          }
          
          await queryRunner.manager
            .createQueryBuilder()
            .update(Task)
            .set({ status: newStatus })
            .whereInIds(taskIds)
            .execute();
          
          results.push({ action: 'update_status', success: true, affected: taskIds.length, newStatus });
          break;

        case 'update_priority':
          if (!newPriority) {
            throw new BadRequestException('New priority is required for update_priority action');
          }
          
          await queryRunner.manager
            .createQueryBuilder()
            .update(Task)
            .set({ priority: newPriority as TaskPriority })
            .whereInIds(taskIds)
            .execute();
          
          results.push({ action: 'update_priority', success: true, affected: taskIds.length, newPriority });
          break;

        default:
          throw new BadRequestException(`Unknown action: ${action}`);
      }

      await queryRunner.commitTransaction();
      return results;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Batch operation failed: ${message}`, error instanceof Error ? error.stack : undefined);
      throw new BadRequestException(`Batch operation failed: ${message}`);
    } finally {
      await queryRunner.release();
    }
  }

  private buildTaskQuery(queryDto: QueryTaskDto): SelectQueryBuilder<Task> {
    const queryBuilder = this.tasksRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.user', 'user');

    // Apply filters
    if (queryDto.status) {
      queryBuilder.andWhere('task.status = :status', { status: queryDto.status });
    }

    if (queryDto.priority) {
      queryBuilder.andWhere('task.priority = :priority', { priority: queryDto.priority });
    }

    if (queryDto.userId) {
      queryBuilder.andWhere('task.userId = :userId', { userId: queryDto.userId });
    }

    if (queryDto.search) {
      queryBuilder.andWhere(
        '(task.title ILIKE :search OR task.description ILIKE :search)',
        { search: `%${queryDto.search}%` }
      );
    }

    if (queryDto.dueDate) {
      queryBuilder.andWhere('task.dueDate = :dueDate', { dueDate: queryDto.dueDate });
    }

    return queryBuilder;
  }
}
