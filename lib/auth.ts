import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'legalwings-crm-secret-key-2024';

export interface JWTPayload {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  team?: string;
}

// 30-day sessions: a logged-in user keeps seeing data across days without having
// to log in again. They only need to re-auth after 30 days of the token sitting
// unused, or when they explicitly log out.
export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function getTokenFromHeaders(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (auth && auth.startsWith('Bearer ')) {
    return auth.substring(7);
  }
  return null;
}
