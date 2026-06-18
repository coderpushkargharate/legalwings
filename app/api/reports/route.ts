import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders, JWTPayload } from '@/lib/auth';

function getAuth(request: Request): JWTPayload | null {
  const token = getTokenFromHeaders(request);
  if (!token) return null;
  return verifyToken(token);
}

// Safely turn a stored value (number or string) into a finite number.
function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v.replace(/[^0-9.\-]/g, '')) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Resolve the most relevant date for a lead and return it (or null).
function leadDate(lead: any): Date | null {
  const raw = lead.leadDate || lead.createdAt || lead.createdDate;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export async function GET(request: Request) {
  const user = getAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const from = fromParam ? new Date(fromParam) : null;
    const to = toParam ? new Date(`${toParam}T23:59:59`) : null;

    const leads = await db.collection('leads').find({}, {
      projection: {
        transitLevel: 1, createdByUserName: 1, forwardedHistory: 1,
        payment: 1, paymentPending: 1, paymentDetails: 1,
        leadDate: 1, createdAt: 1, createdDate: 1,
      },
    }).toArray();

    const perTeam: Record<string, number> = {};
    const createdByPerson: Record<string, number> = {};
    const forwardedByPerson: Record<string, number> = {};
    const perDay: Record<string, number> = {};
    const perMonth: Record<string, number> = {};
    let totalReceived = 0, totalPending = 0, totalCommission = 0, totalAgreement = 0;
    let totalLeads = 0;

    for (const lead of leads as any[]) {
      const d = leadDate(lead);
      // Optional date-range filter applies to all breakdowns.
      if (from && (!d || d < from)) continue;
      if (to && (!d || d > to)) continue;

      totalLeads++;

      const team = (lead.transitLevel || 'UNASSIGNED').toString();
      perTeam[team] = (perTeam[team] || 0) + 1;

      const creator = lead.createdByUserName || 'System';
      createdByPerson[creator] = (createdByPerson[creator] || 0) + 1;

      if (Array.isArray(lead.forwardedHistory)) {
        for (const h of lead.forwardedHistory) {
          const who = h?.forwardedBy || 'Unknown';
          forwardedByPerson[who] = (forwardedByPerson[who] || 0) + 1;
        }
      }

      if (d) {
        const dayKey = d.toISOString().slice(0, 10);          // YYYY-MM-DD
        const monthKey = d.toISOString().slice(0, 7);         // YYYY-MM
        perDay[dayKey] = (perDay[dayKey] || 0) + 1;
        perMonth[monthKey] = (perMonth[monthKey] || 0) + 1;
      }

      // Payments
      const received = Array.isArray(lead.paymentDetails)
        ? lead.paymentDetails.reduce((s: number, p: any) => s + num(p.paymentAmount), 0)
        : 0;
      totalReceived += received || num(lead.payment?.totalReceivedAmount) || num(lead.payment?.paidAmount);
      totalPending += num(lead.paymentPending) || num(lead.payment?.pendingAmount) || num(lead.payment?.outstandingAmount);
      totalCommission += num(lead.payment?.commissionAmount);
      totalAgreement += num(lead.payment?.totalAmount);
    }

    const toSortedArray = (obj: Record<string, number>, byKeyDesc = false) =>
      Object.entries(obj)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => (byKeyDesc ? b.name.localeCompare(a.name) : b.count - a.count));

    return NextResponse.json({
      totalLeads,
      perTeam: toSortedArray(perTeam),
      createdByPerson: toSortedArray(createdByPerson),
      forwardedByPerson: toSortedArray(forwardedByPerson),
      perDay: toSortedArray(perDay, true),
      perMonth: toSortedArray(perMonth, true),
      payments: {
        totalReceived,
        totalPending,
        totalCommission,
        totalAgreement,
      },
    });
  } catch (error) {
    console.error('Reports GET error:', error);
    return NextResponse.json({ error: 'Failed to build reports' }, { status: 500 });
  }
}
