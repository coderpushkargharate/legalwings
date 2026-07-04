'use client';

import { useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';

export function useApi() {
  const { token } = useAuth();

  // Memoized so its identity only changes when the token changes. Without this,
  // a new function was created every render, causing effects that depend on
  // apiFetch (e.g. dashboard reports) to refetch in an infinite loop.
  const apiFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, { ...options, headers });
    return res;
  }, [token]);

  return { apiFetch };
}
