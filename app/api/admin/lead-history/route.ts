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

  // Lead history is available to admins and to the Shop team (which uses the
  // lead-only history search on its dashboard). Employee history lives on a
  // separate route and stays admin-only.
  const roles = (user.roles || []).map(r => String(r).toLowerCase());
  const canView = roles.includes('admin') || roles.includes('shop');
  if (!canView) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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

      const st = escapeRegex(q);
      const rx = { $regex: st, $options: 'i' };
      // Match a full "First Last" name against the separate first/last name fields,
      // so searching "Ramesh Kumar" finds the lead even though the name is split.
      const fullName = (first: string, last: string) => ({
        $expr: {
          $regexMatch: {
            input: { $concat: [{ $ifNull: [`$${first}`, ''] }, ' ', { $ifNull: [`$${last}`, ''] }] },
            regex: st,
            options: 'i',
          },
        },
      });
      const leads = await db.collection('leads').aggregate([
        {
          $match: {
            // Search across everything the form captures: client, owner & tenant
            // (name / phone / email), agreement token/status/address and payment refs —
            // so ANY value typed into the box surfaces the lead, not just the lead name.
            $or: [
              // Client / lead
              { 'client.firstName': rx },
              { 'client.lastName': rx },
              { 'client.phoneNo': rx },
              { 'client.email': rx },
              { 'client.clientType': rx },
              { 'client.cityName': rx },
              { 'client.areaName': rx },
              { 'city.name': rx },
              { 'area.name': rx },
              { leadStatus: rx },
              { leadSource: rx },
              { visitAddress: rx },
              { description: rx },
              { assignedToUserName: rx },
              { createdByUserName: rx },
              // Agreement
              { 'agreement.tokenNo': rx },
              { 'agreement.mobileNo': rx },
              { 'agreement.status': rx },
              { 'agreement.backOfficeStatus': rx },
              { 'agreement.executeDate': rx },
              { 'agreement.addressLine1': rx },
              { 'agreement.addressLine2': rx },
              { 'agreement.description': rx },
              { 'agreement.owner.firstName': rx },
              { 'agreement.owner.lastName': rx },
              { 'agreement.owner.phoneNo': rx },
              { 'agreement.owner.email': rx },
              { 'agreement.owner.aadharNumber': rx },
              { 'agreement.owner.panNumber': rx },
              { 'agreement.tenant.firstName': rx },
              { 'agreement.tenant.lastName': rx },
              { 'agreement.tenant.phoneNo': rx },
              { 'agreement.tenant.email': rx },
              { 'agreement.tenant.aadharNumber': rx },
              { 'agreement.tenant.panNumber': rx },
              // Payment
              { 'payment.grnNumber': rx },
              { 'payment.dhcNumber': rx },
              // Full-name (First + Last) matches for client, owner and tenant.
              fullName('client.firstName', 'client.lastName'),
              fullName('agreement.owner.firstName', 'agreement.owner.lastName'),
              fullName('agreement.tenant.firstName', 'agreement.tenant.lastName'),
            ],
          },
        },
        { $sort: { createdAt: -1 } },
        // A single customer can have many leads (repeat callers). Keep the cap
        // high enough that ALL of one person's leads surface in the search list.
        { $limit: 100 },
        {
          $project: {
            _id: 0,
            id: { $toString: '$_id' },
            leadName,
            phone: '$client.phoneNo',
            leadStatus: '$leadStatus',
            transitLevel: '$transitLevel',
            // Sent so the dropdown can show a date and distinguish the same
            // customer's multiple leads from one another.
            leadDate: { $ifNull: ['$leadDate', '$createdAt'] },
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

    // Full lead row used by User History to preview the lead exactly as it appears
    // in its current team's table (client / agreement / payment / appointment, etc.).
    const fullLead = {
      id: lead._id.toString(),
      client: lead.client || {},
      agreement: lead.agreement || {},
      payment: lead.payment || {},
      leadDate: lead.leadDate || null,
      createdDate: lead.createdAt || null,
      createdByUserName: lead.createdByUserName || '',
      leadStatus: lead.leadStatus || '',
      leadSource: lead.leadSource || '',
      transitLevel: lead.transitLevel || '',
      appointmentTime: lead.appointmentTime || null,
      visitAddress: lead.visitAddress || '',
      visitCount: lead.visitCount || 0,
      area: lead.area || null,
      city: lead.city || null,
      assignedToUserName: lead.assignedToUserName || '',
    };

    return NextResponse.json({
      fullLead,
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
