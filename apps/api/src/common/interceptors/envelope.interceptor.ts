import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Wraps responses in {success, data, meta}. Services returning
 * {data, meta} (paginated lists) are spread; everything else becomes data.
 * Streams/SSE and already-enveloped bodies pass through untouched.
 */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((body) => {
        if (body === undefined || body === null) return { success: true, data: null };
        if (typeof body === 'object' && 'success' in (body as object)) return body;
        if (
          typeof body === 'object' &&
          'data' in (body as object) &&
          'meta' in (body as object)
        ) {
          const { data, meta } = body as { data: unknown; meta: unknown };
          return { success: true, data, meta };
        }
        return { success: true, data: body };
      }),
    );
  }
}
