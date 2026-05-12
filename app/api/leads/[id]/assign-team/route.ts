import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders, JWTPayload } from '@/lib/auth';
import { ObjectId } from 'mongodb';

function getAuth(request: Request): JWTPayload | null {
  const token = getTokenFromHeaders(request);
  if (!token) return null;
  return verifyToken(token);
}

// Map frontend team names to database transitLevel values
const TEAM_TO_TRANSIT_LEVEL: Record<string, string> = {
  CALLING: 'CALLING_TEAM',
  EXECUTIVE: 'EXECUTIVE_TEAM',
  BACKEND: 'BACKEND_TEAM',
  ACCOUNTING: 'ACCOUNTING_TEAM',
  MARKETING: 'MARKETING_TEAM',
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const { db } = await connectToDatabase();
    const { id } = await params;
    const body = await request.json();
    const { team, assignedToUserId, reason } = body;

    if (!team || !TEAM_TO_TRANSIT_LEVEL[team]) {
      return NextResponse.json({ error: 'Invalid team specified' }, { status: 400 });
    }

    const destinationTransitLevel = TEAM_TO_TRANSIT_LEVEL[team];

    // 🔹 If assigning to specific employee, verify they belong to the team
    let assignedEmployeeName = null;
    if (assignedToUserId) {
      const employee = await db.collection('users').findOne({
        _id: new ObjectId(assignedToUserId),
        roles: { $in: [team.toLowerCase(), 'employee'] }
      });
      if (!employee) {
        return NextResponse.json({ error: 'Employee not found or not part of selected team' }, { status: 400 });
      }
      assignedEmployeeName = `${employee.firstName} ${employee.lastName}`;
    }

    // ✅ Get current lead to track forwarding history
    const currentLead = await db.collection('leads').findOne({ _id: new ObjectId(id) });
    if (!currentLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // ✅ Create history entry for audit trail
    const forwardEntry = {
      fromTeam: currentLead.transitLevel || 'UNKNOWN',
      toTeam: destinationTransitLevel,
      forwardedBy: `${user.firstName} ${user.lastName}`,
      forwardedByUserId: user.userId,
      forwardedAt: new Date(),
      reason: reason || null,
    };

    // ✅ FIXED: Update Logic for BIDIRECTIONAL visibility
    const updateObj: any = {
      $set: {
        transitLevel: destinationTransitLevel,
        updatedAt: new Date(),
        updatedByUserId: user.userId,
        updatedByUserName: `${user.firstName} ${user.lastName}`,
        forwardedTo: team,
        forwardedAt: new Date(),
        forwardedBy: user.userId,
        forwardReason: reason || null,
      },
      $addToSet: { visibleToTeams: destinationTransitLevel },
      $push: { forwardedHistory: forwardEntry }
    };

    if (assignedToUserId) {
      updateObj.$set.assignedToUserId = new ObjectId(assignedToUserId);
      updateObj.$set.assignedToUserName = assignedEmployeeName;
      updateObj.$set.assignedAt = new Date();
    } else {
      updateObj.$set.assignedToUserId = null;
      updateObj.$set.assignedToUserName = null;
    }

    const result = await db.collection('leads').updateOne(
      { _id: new ObjectId(id) },
      updateObj
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: assignedToUserId
        ? `Lead successfully assigned to ${assignedEmployeeName} in ${team} team`
        : `Lead successfully forwarded to ${team} team`,
      leadId: id,
      newTransitLevel: destinationTransitLevel,
      assignedToUserId: assignedToUserId || null,
      visibleToTeams: [...(currentLead.visibleToTeams || []), destinationTransitLevel],
    });
  } catch (error) {
    console.error('Assign team/employee error:', error);
    return NextResponse.json({ error: 'Failed to assign lead' }, { status: 500 });
  }
}