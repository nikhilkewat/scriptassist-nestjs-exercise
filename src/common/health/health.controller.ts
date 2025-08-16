import { Controller, Get, HttpStatus, Optional } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@ApiTags('health')
@Controller('health')
export class HealthController {
    constructor(
        @InjectDataSource()
        private dataSource: DataSource,
        @Optional()
        @InjectQueue('task-processing')
        private taskQueue: Queue | null,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Health check endpoint' })
    @ApiResponse({ status: 200, description: 'System is healthy' })
    @ApiResponse({ status: 503, description: 'System is unhealthy' })
    async check() {
        const checks = {
            database: await this.checkDatabase(),
            queue: await this.checkQueue(),
            timestamp: new Date().toISOString(),
        };

        // If queue is not available, only check database health
        const isHealthy = checks.database.status === 'up' && 
            (this.taskQueue ? checks.queue.status === 'up' : true);
        const statusCode = isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

        return {
            status: isHealthy ? 'healthy' : 'unhealthy',
            checks,
            timestamp: checks.timestamp,
        };
    }

    @Get('ready')
    @ApiOperation({ summary: 'Readiness check endpoint' })
    @ApiResponse({ status: 200, description: 'System is ready to serve traffic' })
    @ApiResponse({ status: 503, description: 'System is not ready' })
    async ready() {
        const checks = {
            database: await this.checkDatabase(),
            queue: await this.checkQueue(),
        };

        // If queue is not available, only check database readiness
        const isReady = checks.database.status === 'up' && 
            (this.taskQueue ? checks.queue.status === 'up' : true);
        const statusCode = isReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

        return {
            status: isReady ? 'ready' : 'not ready',
            checks,
            timestamp: new Date().toISOString(),
        };
    }

    @Get('live')
    @ApiOperation({ summary: 'Liveness check endpoint' })
    @ApiResponse({ status: 200, description: 'System is alive' })
    async live() {
        return {
            status: 'alive',
            timestamp: new Date().toISOString(),
        };
    }

    private async checkDatabase() {
        try {
            await this.dataSource.query('SELECT 1');
            return {
                status: 'up',
                responseTime: Date.now(),
            };
        } catch (error: any) {
            return {
                status: 'down',
                error: error.message,
                responseTime: Date.now(),
            };
        }
    }

    private async checkQueue() {
        if (!this.taskQueue) {
            return {
                status: 'disabled',
                message: 'Queue service not available',
                responseTime: Date.now(),
            };
        }

        try {
            // Check if we can connect to the queue
            await this.taskQueue.getJobCounts();
            return {
                status: 'up',
                responseTime: Date.now(),
            };
        } catch (error: any) {
            return {
                status: 'down',
                error: error.message,
                responseTime: Date.now(),
            };
        }
    }
}
