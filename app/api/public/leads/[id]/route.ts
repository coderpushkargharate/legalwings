// app/api/public/leads/[id]/route.ts
// External Developer API — single lead actions
//   GET   /api/public/leads/:id  → full lead incl. activities & statusHistory
//   PATCH /api/public/leads/:id  → update status / add note / edit fields
// Auth: x-api-key header.
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requireApiKey, jsonResponse, handleOptions, activityEntry } from '@/lib/publicApi';

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return jsonResponse(request, { error: 'Invalid lead id' }, 400);
  }

  try {
    const { db } = await connectToDatabase();
    const lead = await db.collection('leads').findOne({ _id: new ObjectId(id) });
    if (!lead) return jsonResponse(request, { error: 'Lead not found' }, 404);
    return jsonResponse(request, { success: true, lead: { ...lead, id: lead._id.toString(), _id: undefined } });
  } catch (error) {
    console.error('Public lead GET error:', error);
    return jsonResponse(request, { error: 'Failed to fetch lead' }, 500);
  }
}

// Fields an external developer is allowed to edit directly. Visibility /
// assignment / team fields are intentionally excluded — those move only via the
// /forward endpoint so the team queues stay consistent.
const EDITABLE_FIELDS = new Set(['description', 'visitAddress', 'leadSource']);

export async function PATCH(
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

  try {
    const { db } = await connectToDatabase();
    const _id = new ObjectId(id);
    const existing = await db.collection('leads').findOne({ _id });
    if (!existing) return jsonResponse(request, { error: 'Lead not found' }, 404);

    const set: Record<string, unknown> = { updatedAt: new Date(), updatedByUserName: 'External API' };
    const push: Record<string, unknown> = {};
    const activities: Record<string, unknown>[] = [];

    // 1. Status update — tracked in statusHistory.
    if (body.leadStatus && body.leadStatus !== existing.leadStatus) {
      set.leadStatus = body.leadStatus;
      push.statusHistory = { status: body.leadStatus, at: new Date(), by: 'External API' };
      activities.push(activityEntry('STATUS_CHANGED', `${existing.leadStatus || 'NONE'} → ${body.leadStatus}`));
    }

    // 2. Editable plain fields.
    for (const key of Object.keys(body)) {
      if (EDITABLE_FIELDS.has(key)) {
        set[key] = body[key];
        activities.push(activityEntry('FIELD_UPDATED', `${key} updated`));
      }
    }

    // 3. Free-form activity note (e.g. "Called customer, will visit Monday").
    if (body.note || body.activity) {
      activities.push(activityEntry('NOTE', String(body.note || body.activity)));
    }

    if (activities.length === 0 && Object.keys(push).length === 0) {
      return jsonResponse(request, { error: 'Nothing to update. Send leadStatus, note, or an editable field.' }, 400);
    }

    const update: Record<string, unknown> = { $set: set };
    // Merge statusHistory push + activities push.
    const pushOps: Record<string, unknown> = { ...push };
    if (activities.length) pushOps.activities = { $each: activities };
    if (Object.keys(pushOps).length) update.$push = pushOps;

    await db.collection('leads').updateOne({ _id }, update);
    const updated = await db.collection('leads').findOne({ _id });

    return jsonResponse(request, {
      success: true,
      message: 'Lead updated',
      lead: updated ? { ...updated, id: updated._id.toString(), _id: undefined } : null,
    });
  } catch (error) {
    console.error('Public lead PATCH error:', error);
    return jsonResponse(request, { error: 'Failed to update lead' }, 500);
  }
}
