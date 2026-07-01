import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders, JWTPayload } from '@/lib/auth';
import { ObjectId } from 'mongodb';

function getAuth(request: Request): JWTPayload | null {
  const token = getTokenFromHeaders(request);
  if (!token) return null;
  return verifyToken(token);
}

// ✅ escape user input before embedding it in a RegExp
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 🔐 Admin-only: search leads and view the full history of a single lead —
// every forward action, the current status/assignment, and all payments.
//
//   GET /api/admin/lead-history?search=<name|phone>  → matching leads (list)
//   GET /api/admin/lead-history?leadId=<id>          → full history of one lead
export async function GET(request: Request) {
  const user = getAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = user.roles?.includes('admin') || user.roles?.includes('ADMIN');
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');
    const search = searchParams.get('search');

    const leadName = {
      $trim: {
        input: {
          $concat: [
            { $ifNull: ['$client.firstName', ''] },
            ' ',
            { $ifNull: ['$client.lastName', ''] },
          ],
        },
      },
    };

    // 🔍 Search mode — return a lightweight list of matching leads.
    if (!leadId) {
      const q = (search || '').trim();
      if (!q) return NextResponse.json({ leads: [] });

      const rx = { $regex: escapeRegex(q), $options: 'i' };
      const leads = await db.collection('leads').aggregate([
        {
          $match: {
            $or: [
              { 'client.firstName': rx },
              { 'client.lastName': rx },
              { 'client.phoneNo': rx },
              { 'agreement.tokenNo': rx },
            ],
          },
        },
        { $sort: { createdAt: -1 } },
        { $limit: 15 },
        {
          $project: {
            _id: 0,
            id: { $toString: '$_id' },
            leadName,
            phone: '$client.phoneNo',
            leadStatus: '$leadStatus',
            transitLevel: '$transitLevel',
          },
        },
      ]).toArray();

      return NextResponse.json({ leads });
    }

    // 📄 Detail mode — full history for one lead.
    if (!ObjectId.isValid(leadId)) {
      return NextResponse.json({ error: 'Valid leadId is required' }, { status: 400 });
    }

    const lead = await db.collection('leads').findOne({ _id: new ObjectId(leadId) });
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    // All payments recorded against this lead (payments collection stores leadId
    // as a string). The lead may also carry an embedded `payment` snapshot.
    const payments = await db.collection('payments')
      .find({ leadId })
      .sort({ createdAt: -1 })
      .toArray();

    const forwards = ((lead.forwardedHistory as Record<string, unknown>[]) || [])
      .slice()
      .reverse();

    const name = `${lead.client?.firstName || ''} ${lead.client?.lastName || ''}`.trim();

    return NextResponse.json({
      lead: {
        id: lead._id.toString(),
        leadName: name || 'Unnamed lead',
        phone: lead.client?.phoneNo || '',
        clientType: lead.client?.clientType || '',
        leadStatus: lead.leadStatus || '',
        leadSource: lead.leadSource || '',
        transitLevel: lead.transitLevel || '',
        city: lead.city?.name || lead.city || '',
        area: lead.area?.name || lead.area || '',
        createdByUserName: lead.createdByUserName || '',
        createdAt: lead.createdAt || null,
        assignedToUserName: lead.assignedToUserName || '',
        assignedAt: lead.assignedAt || null,
        updatedByUserName: lead.updatedByUserName || '',
        updatedAt: lead.updatedAt || null,
      },
      stats: {
        forwarded: forwards.length,
        payments: payments.length,
      },
      forwards: forwards.map(f => ({
        fromTeam: f.fromTeam,
        toTeam: f.toTeam,
        forwardedBy: f.forwardedBy,
        reason: f.reason,
        forwardedAt: f.forwardedAt,
      })),
      // Prefer the payments collection; fall back to the embedded snapshot so a
      // lead saved before the collection existed still shows its payment.
      payments: payments.length
        ? payments.map(p => ({
            id: p._id.toString(),
            totalAmount: p.totalAmount ?? null,
            commissionAmount: p.commissionAmount ?? null,
            commissionName: p.commissionName ?? '',
            grnNumber: p.grnNumber ?? '',
            dhcNumber: p.dhcNumber ?? '',
            description: p.description ?? '',
            paymentDate: p.commissionDate || p.paymentDate || p.createdAt || null,
            createdAt: p.createdAt || null,
          }))
        : lead.payment
          ? [{
              id: lead.payment.id || 'embedded',
              totalAmount: lead.payment.totalAmount ?? null,
              commissionAmount: lead.payment.commissionAmount ?? null,
              commissionName: lead.payment.commissionName ?? '',
              grnNumber: lead.payment.grnNumber ?? '',
              dhcNumber: lead.payment.dhcNumber ?? '',
              description: lead.payment.description ?? '',
              paymentDate: lead.payment.commissionDate || lead.payment.paymentDate || null,
              createdAt: lead.payment.createdAt || null,
            }]
          : [],
    });
  } catch (error) {
    console.error('Lead history GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch lead history' }, { status: 500 });
  }
}
