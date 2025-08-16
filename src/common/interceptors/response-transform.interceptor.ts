import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  data: T;
  timestamp: string;
  path: string;
  method: string;
  statusCode: number;
}

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    return next.handle().pipe(
      map(data => {
        // Don't transform if it's already a paginated response or error
        if (data && (data.total !== undefined || data.statusCode)) {
          return data;
        }

        return {
          data,
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
          statusCode: response.statusCode,
        };
      }),
    );
  }
}
