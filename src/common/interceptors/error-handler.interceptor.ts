import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class ErrorHandlerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorHandlerInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError(error => {
        const request = context.switchToHttp().getRequest();
        const { method, url, body, user } = request;

        // Log the error with context
        this.logger.error(
          `Error in ${method} ${url}: ${error.message}`,
          {
            method,
            url,
            body: this.sanitizeBody(body),
            userId: user?.id,
            stack: error.stack,
          }
        );

        // If it's already an HTTP exception, re-throw it
        if (error instanceof HttpException) {
          return throwError(() => error);
        }

        // Handle TypeORM errors
        if (error.code === '23505') { // Unique constraint violation
          return throwError(() => new HttpException(
            'Resource already exists',
            HttpStatus.CONFLICT
          ));
        }

        if (error.code === '23503') { // Foreign key constraint violation
          return throwError(() => new HttpException(
            'Referenced resource not found',
            HttpStatus.BAD_REQUEST
          ));
        }

        if (error.code === '42P01') { // Undefined table
          return throwError(() => new HttpException(
            'Service temporarily unavailable',
            HttpStatus.SERVICE_UNAVAILABLE
          ));
        }

        // Handle validation errors
        if (error.name === 'ValidationError') {
          return throwError(() => new HttpException(
            'Validation failed',
            HttpStatus.BAD_REQUEST
          ));
        }

        // Handle unknown errors
        const isDevelopment = process.env.NODE_ENV === 'development';
        
        if (isDevelopment) {
          return throwError(() => new HttpException(
            {
              message: 'Internal server error',
              error: error.message,
              stack: error.stack,
            },
            HttpStatus.INTERNAL_SERVER_ERROR
          ));
        }

        return throwError(() => new HttpException(
          'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR
        ));
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;
    
    const sanitized = { ...body };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }
}
