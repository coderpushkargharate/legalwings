// app/api/public/leads/[id]/forward/route.ts
// External Developer API — share / forward a lead to a specific team
//   POST /api/public/leads/:id/forward
//   body: { "team": "BACKEND", "assignedToUserId": "<optional>", "reason": "<optional>" }
// Auth: x-api-key header.
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requireApiKey, jsonResponse, handleOptions, activityEntry } from '@/lib/publicApi';

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

// Accept either short ("BACKEND") or full ("BACKEND_TEAM") team names.
const TEAM_TO_TRANSIT: Record<string, string> = {
  CALLING: 'CALLING_TEAM',
  EXECUTIVE: 'EXECUTIVE_TEAM',
  BACKEND: 'BACKEND_TEAM',
  ACCOUNTING: 'ACCOUNTING_TEAM',
  MARKETING: 'MARKETING_TEAM',
};

function resolveTransit(team: string): string | null {
  const upper = (team || '').toUpperCase().replace(/_TEAM$/, '');
  return TEAM_TO_TRANSIT[upper] || null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return jsonResponse(request, { error: 'Invalid lead id' }, 400);
  }

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: 'Invalid JSON payload' }, 400);
  }

  const transitLevel = resolveTransit(body.team);
  if (!transitLevel) {
    return jsonResponse(request, {
      error: 'Invalid or missing team',
      validTeams: Object.keys(TEAM_TO_TRANSIT),
    }, 400);
  }

  try {
    const { db } = await connectToDatabase();
    const _id = new ObjectId(id);
    const lead = await db.collection('leads').findOne({ _id });
    if (!lead) return jsonResponse(request, { error: 'Lead not found' }, 404);

    // Optional: assign to a specific employee, validated against the team.
    let assignedName: string | null = null;
    const set: Record<string, unknown> = {
      transitLevel,
      forwardedTo: transitLevel,
      forwardedAt: new Date(),
      forwardReason: body.reason || null,
      updatedAt: new Date(),
      updatedByUserName: 'External API',
    };

    if (body.assignedToUserId) {
      if (!ObjectId.isValid(body.assignedToUserId)) {
        return jsonResponse(request, { error: 'Invalid assignedToUserId' }, 400);
      }
      const teamRole = transitLevel.replace('_TEAM', '').toLowerCase();
      const employee = await db.collection('users').findOne({
        _id: new ObjectId(body.assignedToUserId),
        roles: { $in: [teamRole, 'employee'] },
      });
      if (!employee) {
        return jsonResponse(request, { error: 'Employee not found or not part of selected team' }, 400);
      }
      assignedName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
      set.assignedToUserId = new ObjectId(body.assignedToUserId);
      set.assignedToUserName = assignedName;
      set.assignedAt = new Date();
    } else {
      set.assignedToUserId = null;
      set.assignedToUserName = null;
    }

    const forwardEntry = {
      fromTeam: lead.transitLevel || 'UNKNOWN',
      toTeam: transitLevel,
      forwardedBy: 'External API',
      forwardedAt: new Date(),
      reason: body.reason || null,
    };

    const detail = assignedName
      ? `Forwarded to ${transitLevel} and assigned to ${assignedName}`
      : `Forwarded to ${transitLevel}`;

    // Bidirectional visibility by default (lead stays visible to the source team),
    // EXCEPT when forwarding to the BACKEND team, where the source team is removed
    // so the lead leaves the source list. Matches the internal assign-team behavior.
    const sourceTransit = lead.transitLevel as string | undefined;
    let newVisibleToTeams = Array.from(
      new Set([...((lead.visibleToTeams as string[]) || []), transitLevel])
    );
    const isBackend = resolveTransit(body.team) === 'BACKEND_TEAM';
    if (isBackend && sourceTransit) {
      newVisibleToTeams = newVisibleToTeams.filter((t) => t !== sourceTransit);
    }
    set.visibleToTeams = newVisibleToTeams;

    await db.collection('leads').updateOne(
      { _id },
      {
        $set: set,
        $push: {
          forwardedHistory: forwardEntry,
          activities: activityEntry('FORWARDED', detail),
        },
      } as Record<string, unknown>,
    );

    return jsonResponse(request, {
      success: true,
      message: detail,
      leadId: id,
      transitLevel,
      assignedToUserId: body.assignedToUserId || null,
      assignedToUserName: assignedName,
    });
  } catch (error) {
    console.error('Public lead forward error:', error);
    return jsonResponse(request, { error: 'Failed to forward lead' }, 500);
  }
}
