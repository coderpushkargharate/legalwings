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
  SHOP: 'SHOP_TEAM',
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

    // ✅ Compute new visibility list.
    // Forwarding to ANY team simply ADDS the destination team (bidirectional visibility)
    // and never removes a team the lead has already touched. This keeps the lead on every
    // source team's MAIN (admin) dashboard — e.g. after an Executive employee forwards a
    // lead back to Calling/Backend it stays visible under the Executive Team section — while
    // the forwarding employee still loses it from their PERSONAL dashboard, because employee
    // dashboards key off the lead's current `transitLevel` (which now points at the
    // destination team), not off `visibleToTeams`.
    const newVisibleToTeams = Array.from(
      new Set([...(currentLead.visibleToTeams || []), destinationTransitLevel])
    );

    // 🔹 Business rule: once a lead is forwarded TO the Backend Team — whether via
    // the Executive Team OR sent DIRECTLY from the Calling Team — it must disappear
    // from the Calling Team completely. Calling dashboards (admin + the calling
    // employee who created it) filter on visibleToTeams containing CALLING_TEAM, so
    // we drop CALLING_TEAM from the visibility list here. Executive & Backend
    // visibility is untouched, so the lead keeps showing under the Executive Team,
    // the assigned Executive employee and the Backend team exactly as the existing
    // logic already handles.
    if (
      team === 'BACKEND' &&
      (currentLead.transitLevel === 'EXECUTIVE_TEAM' || currentLead.transitLevel === 'CALLING_TEAM')
    ) {
      const idx = newVisibleToTeams.indexOf('CALLING_TEAM');
      if (idx !== -1) newVisibleToTeams.splice(idx, 1);
    }

    // 🔹 Symmetric business rule: when a lead is sent FROM the Backend Team back
    // TO the Calling Team, it must disappear from the Backend Team completely and
    // show only to the Calling Team. Backend dashboards (admin + backend employee)
    // filter on visibleToTeams containing BACKEND_TEAM, so we drop BACKEND_TEAM
    // from the visibility list here.
    if (team === 'CALLING' && currentLead.transitLevel === 'BACKEND_TEAM') {
      const idx = newVisibleToTeams.indexOf('BACKEND_TEAM');
      if (idx !== -1) newVisibleToTeams.splice(idx, 1);
    }

    // Use $set for visibleToTeams (instead of $addToSet) because we may also need to
    // remove the source team — $addToSet and $pull cannot touch the same field in one update.
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
        visibleToTeams: newVisibleToTeams,
      },
      $push: { forwardedHistory: forwardEntry }
    };

    // Once a lead moves to the Backend team it is no longer an active appointment,
    // so clear the flag that keeps it in the Calling/Executive Appointments list.
    if (team === 'BACKEND') {
      updateObj.$set.isAppointment = false;
    }

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
      visibleToTeams: newVisibleToTeams,
    });
  } catch (error) {
    console.error('Assign team/employee error:', error);
    return NextResponse.json({ error: 'Failed to assign lead' }, { status: 500 });
  }
}