'use client';

import { create } from 'zustand';
import { api, setAccessToken, ApiError } from './api';

export interface Me {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  locale: string;
  roles: { key: string; name: string }[];
  permissions: string[];
  branchIds: string[];
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
    trialEndsAt: string | null;
    plan: { code: string; name: string; limits: Record<string, number>; features: Record<string, boolean> } | null;
  };
}

interface AuthState {
  user: Me | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
  can: (permission: string) => boolean;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  status: 'loading',

  async login(email, password) {
    const res = await api.post<{ accessToken: string; user: Me }>('/auth/login', {
      email,
      password,
    });
    setAccessToken(res.accessToken);
    set({ user: res.user, status: 'authenticated' });
  },

  async logout() {
    await api.post('/auth/logout').catch(() => undefined);
    setAccessToken(null);
    set({ user: null, status: 'unauthenticated' });
  },

  /** Silent session restore via refresh cookie on app load. */
  async bootstrap() {
    try {
      const res = await api.post<{ accessToken: string }>('/auth/refresh');
      setAccessToken(res.accessToken);
      const user = await api.get<Me>('/auth/me');
      set({ user, status: 'authenticated' });
    } catch (err) {
      if (err instanceof ApiError || err instanceof Error) {
        setAccessToken(null);
        set({ user: null, status: 'unauthenticated' });
      }
    }
  },

  can(permission) {
    return get().user?.permissions.includes(permission) ?? false;
  },
}));
