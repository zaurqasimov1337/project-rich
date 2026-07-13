const BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function requestEnvelope(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

  const body = await res.json().catch(() => null);
  if (!res.ok || body?.success === false) {
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'INTERNAL', err.message ?? 'Request failed', err.details);
  }
  return body as { data?: unknown; meta?: unknown };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const body = await requestEnvelope(path, init);
  return body?.data !== undefined ? (body.data as T) : (body as T);
}

export interface ListResult<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; unread?: number };
}

/** For paginated endpoints — preserves the meta block. */
async function requestList<T>(path: string): Promise<ListResult<T>> {
  const body = await requestEnvelope(path);
  return {
    data: (body.data as T[]) ?? [],
    meta: (body.meta as ListResult<T>['meta']) ?? { page: 1, limit: 20, total: 0 },
  };
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  list: <T>(path: string) => requestList<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  raw: request,
};
