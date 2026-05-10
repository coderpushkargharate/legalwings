// app/api/leads/[id]/assign-team/route.ts
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
    const { team } = body;

    if (!team || !TEAM_TO_TRANSIT_LEVEL[team]) {
      return NextResponse.json({ error: 'Invalid team specified' }, { status: 400 });
    }

    const transitLevel = TEAM_TO_TRANSIT_LEVEL[team];

    // Update the lead's transitLevel and audit fields
    const result = await db.collection('leads').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          transitLevel,
          updatedAt: new Date(),
          updatedByUserId: user.userId,
          updatedByUserName: `${user.firstName} ${user.lastName}`,
          // Optional: Track forwarding history
          forwardedTo: team,
          forwardedAt: new Date(),
          forwardedBy: user.userId,
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: `Lead successfully forwarded to ${team} team`,
      leadId: id,
      newTransitLevel: transitLevel,
    });
  } catch (error) {
    console.error('Assign team error:', error);
    return NextResponse.json({ error: 'Failed to forward lead' }, { status: 500 });
  }
}