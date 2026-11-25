import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export interface ApiResponse<T> {
  success: true;
  data: T;
  message: string;
  meta?: PaginationMeta;
}

interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

function isPaginated(value: unknown): value is PaginatedResult<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'items' in value &&
    'meta' in value &&
    Array.isArray((value as { items: unknown }).items)
  );
}

@Injectable()
export class ResponseWrapperInterceptor<T>
  implements NestInterceptor<T, ApiResponse<unknown> | undefined>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<unknown> | undefined> {
    const message =
      this.reflector.get<string>(RESPONSE_MESSAGE_KEY, context.getHandler()) ??
      'Success';

    return next.handle().pipe(
      map((result) => {
        const response = context.switchToHttp().getResponse<Response>();

        if (response.statusCode === HttpStatus.NO_CONTENT) {
          return undefined;
        }

        if (isPaginated(result)) {
          return {
            success: true as const,
            data: result.items,
            message,
            meta: result.meta,
          };
        }

        return {
          success: true as const,
          data: result,
          message,
        };
      }),
    );
  }
}