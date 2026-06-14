// lib/publicApi.ts
// Shared helpers for the External Developer API (/api/public/*).
//
// These routes are meant to be called from OTHER websites/apps by third-party
// developers, so they DO NOT use the dashboard JWT. Instead they authenticate
// with a static API key sent in the `x-api-key` header (also accepted as a
// Bearer token or `?apiKey=` query param for convenience).
import { NextResponse } from 'next/server';

// Allow cross-origin browser calls. Override with a comma-separated list in
// PUBLIC_API_ALLOWED_ORIGINS to lock it down to specific developer sites.
const ALLOWED_ORIGINS = (process.env.PUBLIC_API_ALLOWED_ORIGINS || '*')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || '';
  let allowOrigin = '*';
  if (!ALLOWED_ORIGINS.includes('*')) {
    allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || '*';
  }
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

// Standard JSON response that always carries CORS headers.
export function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
): NextResponse {
  return NextResponse.json(body, { status, headers: corsHeaders(request) });
}

// Pull the API key from header / bearer / query string.
function extractApiKey(request: Request): string | null {
  const headerKey = request.headers.get('x-api-key');
  if (headerKey) return headerKey;

  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.substring(7);

  const url = new URL(request.url);
  return url.searchParams.get('apiKey');
}

// Returns null when authorized, or a ready-to-send 401 response otherwise.
export function requireApiKey(request: Request): NextResponse | null {
  const expected = process.env.EXTERNAL_LEADS_API_KEY;
  const provided = extractApiKey(request);

  if (!expected) {
    return jsonResponse(
      request,
      { error: 'Server misconfigured: EXTERNAL_LEADS_API_KEY is not set' },
      500,
    );
  }
  if (!provided || provided !== expected) {
    return jsonResponse(
      request,
      { error: 'Unauthorized: invalid or missing API key (send it in the x-api-key header)' },
      401,
    );
  }
  return null;
}

// Preflight handler shared by every public route.
export function handleOptions(request: Request): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

// Build one activity/timeline entry. Every external mutation (create, status
// change, forward, note) pushes one of these into the lead's `activities`
// array so developers get a full status-tracking trail.
export function activityEntry(action: string, detail: string, by = 'External API') {
  return { action, detail, by, at: new Date() };
}
