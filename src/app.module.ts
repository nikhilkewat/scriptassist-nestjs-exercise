import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersModule } from './modules/users/users.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { AuthModule } from './modules/auth/auth.module';
import { CacheService } from './common/services/cache.service';
import { HealthModule } from './common/health/health.module';
import * as dotenv from 'dotenv';

// Load environment variables manually first
dotenv.config();

@Module({
  imports: [
    // Configuration - Load .env file first
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: false,
      load: [() => {
        console.log('=== ENVIRONMENT VARIABLES DEBUG ===');
        console.log('process.env.DB_HOST:', process.env.DB_HOST);
        console.log('process.env.DB_PORT:', process.env.DB_PORT);
        console.log('process.env.DB_USERNAME:', process.env.DB_USERNAME);
        console.log('process.env.DB_PASSWORD:', process.env.DB_PASSWORD ? '[REDACTED]' : 'undefined');
        console.log('process.env.DB_DATABASE:', process.env.DB_DATABASE);
        console.log('process.env.NODE_ENV:', process.env.NODE_ENV);
        console.log('REDIS_ENABLED:', process.env.REDIS_ENABLED);
        console.log('=== END DEBUG ===');
        return process.env;
      }],
    }),
    
    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // Get values with fallbacks
        const host = configService.get('DB_HOST') || process.env.DB_HOST || 'localhost';
        const port = parseInt(configService.get('DB_PORT') || process.env.DB_PORT || '5433', 10);
        const username = configService.get('DB_USERNAME') || process.env.DB_USERNAME || 'postgres';
        const password = configService.get('DB_PASSWORD') || process.env.DB_PASSWORD || 'sa@123';
        const database = configService.get('DB_DATABASE') || process.env.DB_DATABASE || 'taskflow';
        const nodeEnv = configService.get('NODE_ENV') || process.env.NODE_ENV || 'development';
        
        console.log('=== TYPEORM CONFIGURATION DEBUG ===');
        console.log('ConfigService values:');
        console.log('  DB_HOST:', configService.get('DB_HOST'));
        console.log('  DB_PORT:', configService.get('DB_PORT'));
        console.log('  DB_USERNAME:', configService.get('DB_USERNAME'));
        console.log('  DB_PASSWORD:', configService.get('DB_PASSWORD') ? '[REDACTED]' : 'undefined');
        console.log('  DB_DATABASE:', configService.get('DB_DATABASE'));
        console.log('  NODE_ENV:', configService.get('NODE_ENV'));
        console.log('Final configuration:');
        console.log('  host:', host);
        console.log('  port:', port);
        console.log('  username:', username);
        console.log('  password:', password ? '[REDACTED]' : 'undefined');
        console.log('  database:', database);
        console.log('  type: postgres');
        console.log('=== END TYPEORM DEBUG ===');
        
        const config = {
          type: 'postgres' as const,
          host,
          port,
          username,
          password,
          database,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: nodeEnv === 'development',
          logging: nodeEnv === 'development',
        };
        
        return config;
      },
    }),
    
    // Scheduling
    ScheduleModule.forRoot(),
    
    // Feature modules
    UsersModule,
    TasksModule,
    AuthModule,
    
    // Health module
    HealthModule,
    
    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ([
        {
          ttl: 60,
          limit: 10,
        },
      ]),
    }),
  ],
  providers: [
    // Inefficient: Global cache service with no configuration options
    // This creates a single in-memory cache instance shared across all modules
    CacheService
  ],
  exports: [
    // Exporting the cache service makes it available to other modules
    // but creates tight coupling
    CacheService
  ]
})
export class AppModule {} 