'use client';

import { create } from 'zustand';
import { ApiError } from './api';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

let platformToken: string | null = null;

async function prequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(platformToken ? { Authorization: `Bearer ${platformToken}` } : {}),
      ...init.headers,
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.success === false) {
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'INTERNAL', err.message ?? 'Request failed', err.details);
  }
  return body?.data !== undefined ? (body.data as T) : (body as T);
}

export const platformApi = {
  get: <T>(path: string) => prequest<T>(path),
  post: <T>(path: string, data?: unknown) =>
    prequest<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    prequest<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  list: async <T>(path: string) => {
    const res = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      headers: platformToken ? { Authorization: `Bearer ${platformToken}` } : {},
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.success === false) {
      const err = body?.error ?? {};
      throw new ApiError(res.status, err.code ?? 'INTERNAL', err.message ?? 'Request failed');
    }
    return { data: (body.data ?? []) as T[], meta: body.meta ?? { page: 1, limit: 20, total: 0 } };
  },
};

export interface PlatformUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface PlatformAuthState {
  user: PlatformUser | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
}

export const usePlatformAuth = create<PlatformAuthState>((set) => ({
  user: null,
  status: 'loading',

  async login(email, password) {
    const res = await prequest<{ accessToken: string; user: PlatformUser }>(
      '/platform/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    );
    platformToken = res.accessToken;
    set({ user: res.user, status: 'authenticated' });
  },

  async logout() {
    await prequest('/platform/auth/logout', { method: 'POST' }).catch(() => undefined);
    platformToken = null;
    set({ user: null, status: 'unauthenticated' });
  },

  async bootstrap() {
    try {
      const res = await prequest<{ accessToken: string }>('/platform/auth/refresh', {
        method: 'POST',
      });
      platformToken = res.accessToken;
      const user = await prequest<PlatformUser>('/platform/auth/me');
      set({ user, status: 'authenticated' });
    } catch {
      platformToken = null;
      set({ user: null, status: 'unauthenticated' });
    }
  },
}));
