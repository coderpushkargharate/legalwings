import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders, JWTPayload } from '@/lib/auth';
import { ObjectId } from 'mongodb';

function getAuth(request: Request): JWTPayload | null {
  const token = getTokenFromHeaders(request);
  if (!token) return null;
  return verifyToken(token);
}

// 🔐 Admin-only: full activity history for a single user (employee).
// Returns leads they created, leads currently assigned to them, and every
// forward action they performed (flattened from each lead's forwardedHistory).
export async function GET(request: Request) {
  const user = getAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = user.roles?.includes('admin') || user.roles?.includes('ADMIN');
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId || !ObjectId.isValid(userId)) {
      return NextResponse.json({ error: 'Valid userId is required' }, { status: 400 });
    }

    const objId = new ObjectId(userId);

    const target = await db.collection('users').findOne({ _id: objId });
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

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

    // Forward actions performed by this user (forwardedByUserId is stored as a string).
    const forwards = await db.collection('leads').aggregate([
      { $match: { 'forwardedHistory.forwardedByUserId': userId } },
      { $unwind: '$forwardedHistory' },
      { $match: { 'forwardedHistory.forwardedByUserId': userId } },
      { $sort: { 'forwardedHistory.forwardedAt': -1 } },
      { $limit: 300 },
      {
        $project: {
          _id: 0,
          leadId: { $toString: '$_id' },
          leadName,
          phone: '$client.phoneNo',
          fromTeam: '$forwardedHistory.fromTeam',
          toTeam: '$forwardedHistory.toTeam',
          reason: '$forwardedHistory.reason',
          forwardedAt: '$forwardedHistory.forwardedAt',
        },
      },
    ]).toArray();

    const projectLead = {
      _id: 0,
      id: { $toString: '$_id' },
      leadName,
      phone: '$client.phoneNo',
      transitLevel: '$transitLevel',
      leadStatus: '$leadStatus',
      createdAt: '$createdAt',
      assignedAt: '$assignedAt',
      // Payment snapshot so each lead row can show what was collected.
      paymentAmount: { $ifNull: ['$payment.totalAmount', null] },
      commissionAmount: { $ifNull: ['$payment.commissionAmount', null] },
    };

    const createdLeads = await db.collection('leads').aggregate([
      { $match: { createdByUserId: userId } },
      { $sort: { createdAt: -1 } },
      { $limit: 300 },
      { $project: projectLead },
    ]).toArray();

    const assignedLeads = await db.collection('leads').aggregate([
      { $match: { assignedToUserId: objId } },
      { $sort: { assignedAt: -1, createdAt: -1 } },
      { $limit: 300 },
      { $project: projectLead },
    ]).toArray();

    // 💰 Total payment collected across every lead this user created OR is
    // assigned to (de-duplicated so a lead counted in both isn't summed twice).
    const paymentAgg = await db.collection('leads').aggregate([
      {
        $match: {
          $or: [{ createdByUserId: userId }, { assignedToUserId: objId }],
          'payment.totalAmount': { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalPayment: { $sum: '$payment.totalAmount' },
          totalCommission: { $sum: { $ifNull: ['$payment.commissionAmount', 0] } },
          count: { $sum: 1 },
        },
      },
    ]).toArray();

    const payments = paymentAgg[0] || { totalPayment: 0, totalCommission: 0, count: 0 };

    return NextResponse.json({
      user: {
        id: target._id.toString(),
        firstName: target.firstName || '',
        lastName: target.lastName || '',
        email: target.email || '',
        team: target.team || 'Unknown',
        roles: target.roles || [],
      },
      stats: {
        created: createdLeads.length,
        assigned: assignedLeads.length,
        forwarded: forwards.length,
        totalPayment: payments.totalPayment || 0,
        totalCommission: payments.totalCommission || 0,
        paidLeads: payments.count || 0,
      },
      forwards,
      createdLeads,
      assignedLeads,
    });
  } catch (error) {
    console.error('User history GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch user history' }, { status: 500 });
  }
}
