'use client';

import { useAuth } from '@/components/auth-provider';

export function useApi() {
  const { token } = useAuth();

  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, { ...options, headers });
    return res;
  };

  return { apiFetch };
}
