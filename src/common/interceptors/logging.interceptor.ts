import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const { method, originalUrl } = request;
    const startedAt = Date.now();

    const write = (statusCode: number) => {
      const ms = Date.now() - startedAt;
      const line = `${method} ${originalUrl} ${statusCode} +${ms}ms`;

      if (statusCode >= 500) {
        this.logger.error(line);
      } else if (statusCode >= 400) {
        this.logger.warn(line);
      } else {
        this.logger.log(line);
      }
    };

    return next.handle().pipe(
      tap({
        next: () => write(response.statusCode),
        error: (err: unknown) =>
          write(err instanceof HttpException ? err.getStatus() : 500),
      }),
    );
  }
}