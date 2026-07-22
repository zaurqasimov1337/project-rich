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
export function getAccessToken(): string | null {
  return accessToken;
}

/** Called when the refresh cookie is gone too — lets the auth store sign out. */
let onSessionExpired: (() => void) | null = null;
export function setOnSessionExpired(handler: (() => void) | null) {
  onSessionExpired = handler;
}

/** Routes that must never trigger a refresh attempt — they are the refresh path. */
const NO_REFRESH = ['/auth/refresh', '/auth/login', '/auth/logout'];

// Concurrent 401s share one refresh instead of firing a stampede of rotations,
// which would invalidate each other (refresh tokens rotate on every use).
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return null;
      const body = await res.json().catch(() => null);
      const token = body?.data?.accessToken ?? body?.accessToken ?? null;
      accessToken = token;
      return token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function requestEnvelope(path: string, init: RequestInit = {}, isRetry = false) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

  // The access token lives ~15 minutes. Rather than surfacing a bare 401 to a
  // user who is mid-task, rotate it via the refresh cookie and replay once.
  if (res.status === 401 && !isRetry && !NO_REFRESH.includes(path)) {
    const token = await refreshAccessToken();
    if (token) return requestEnvelope(path, init, true);
    accessToken = null;
    onSessionExpired?.();
  }

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
