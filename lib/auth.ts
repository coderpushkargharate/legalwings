import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'legalwings-crm-secret-key-2024';

export interface JWTPayload {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
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
