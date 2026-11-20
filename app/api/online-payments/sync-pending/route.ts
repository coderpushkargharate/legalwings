import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { syncPendingPayments } from '@/lib/cashfree';

export const dynamic = 'force-dynamic';

// POST /api/online-payments/sync-pending → re-check recent unpaid / UTR-less links
// with Cashfree. Newly PAID ones are added to their lead (auto-verified).
export async function POST(request: Request) {
  const token = getTokenFromHeaders(request);
  if (!token || !verifyToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { db } = await connectToDatabase();
    const result = await syncPendingPayments(db);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('Cashfree pending sync error:', e);
    return NextResponse.json({ error: e.message || 'Sync failed' }, { status: 502 });
  }
}
