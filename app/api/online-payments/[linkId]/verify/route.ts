import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { syncOnlinePayment } from '@/lib/cashfree';

export const dynamic = 'force-dynamic';

// POST /api/online-payments/:linkId/verify → re-check the status with Cashfree
export async function POST(request: Request, { params }: { params: { linkId: string } }) {
  const token = getTokenFromHeaders(request);
  if (!token || !verifyToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { db } = await connectToDatabase();
    const result = await syncOnlinePayment(db, params.linkId);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('Cashfree verify error:', e);
    return NextResponse.json({ error: e.message || 'Verification failed' }, { status: e.status === 404 ? 404 : 502 });
  }
}
