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
    const { team, assignedToUserId } = body;

    if (!team || !TEAM_TO_TRANSIT_LEVEL[team]) {
      return NextResponse.json({ error: 'Invalid team specified' }, { status: 400 });
    }

    const transitLevel = TEAM_TO_TRANSIT_LEVEL[team];

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

    // Update the lead's transitLevel, assignment, and audit fields
    const updateData: Record<string, any> = {
      transitLevel,
      updatedAt: new Date(),
      updatedByUserId: user.userId,
      updatedByUserName: `${user.firstName} ${user.lastName}`,
      forwardedTo: team,
      forwardedAt: new Date(),
      forwardedBy: user.userId,
    };

    // 🔹 Add employee-specific assignment if provided
    if (assignedToUserId) {
      updateData.assignedToUserId = new ObjectId(assignedToUserId);
      updateData.assignedToUserName = assignedEmployeeName;
      updateData.assignedAt = new Date();
    } else {
      // If assigning to team only, clear any previous employee assignment
      updateData.assignedToUserId = null;
      updateData.assignedToUserName = null;
    }

    const result = await db.collection('leads').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: assignedToUserId 
        ? `Lead successfully assigned to ${assignedEmployeeName} in ${team} team`
        : `Lead successfully forwarded to ${team} team`,
      leadId: id,
      newTransitLevel: transitLevel,
      assignedToUserId: assignedToUserId || null,
    });
  } catch (error) {
    console.error('Assign team/employee error:', error);
    return NextResponse.json({ error: 'Failed to assign lead' }, { status: 500 });
  }
}