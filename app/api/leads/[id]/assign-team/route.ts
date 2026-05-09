// app/api/leads/[id]/assign-team/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = getTokenFromHeaders(request);
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params; // Next.js 15+ compatible
    const { team } = await request.json();

    if (!id || !team) {
      return NextResponse.json({ error: 'Lead ID and team are required' }, { status: 400 });
    }

    // Valid team values
    const validTeams = ['CALLING_TEAM', 'EXECUTIVE_TEAM', 'BACKEND_TEAM', 'MARKETING_TEAM', 'ACCOUNTING_TEAM'];
    if (!validTeams.includes(team)) {
      return NextResponse.json({ error: 'Invalid team value' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Update lead's transitLevel
    const result = await db.collection('leads').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          transitLevel: team,
          updatedAt: new Date(),
          updatedByUserName: (verifyToken(token) as any)?.firstName + ' ' + (verifyToken(token) as any)?.lastName
        } 
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      message: `Lead successfully forwarded to ${team}`,
      leadId: id,
      newTransitLevel: team
    });

  } catch (error) {
    console.error('Assign team error:', error);
    return NextResponse.json({ error: 'Failed to assign team' }, { status: 500 });
  }
}