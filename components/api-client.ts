'use client';

import { useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';

// Requests that stall longer than this are aborted so the UI can never hang
// forever on a dead/slow network (the old behaviour that forced a manual refresh).
const REQUEST_TIMEOUT_MS = 30000;

export function useApi() {
  const { token, logout } = useAuth();

  // Memoized so its identity only changes when the token (or the stable logout)
  // changes. Without this, a new function was created every render, causing
  // effects that depend on apiFetch (e.g. dashboard reports) to refetch in a loop.
  const apiFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Abort the request if it takes too long. Callers already have try/catch/finally
    // that clear their loading state, so an aborted request recovers gracefully
    // instead of leaving a spinner stuck on screen.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, { ...options, headers, signal: options.signal ?? controller.signal });
      // 401 = the session/token is no longer valid (typically expired). Sign the
      // user out cleanly and send them to login instead of showing a dashboard
      // that silently loads no data.
      if (res.status === 401) {
        logout();
      }
      return res;
    } finally {
      clearTimeout(timeoutId);
    }
  }, [token, logout]);

  return { apiFetch };
}
