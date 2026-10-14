import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders, JWTPayload } from '@/lib/auth';

function getAuth(request: Request): JWTPayload | null {
  const token = getTokenFromHeaders(request);
  if (!token) return null;
  return verifyToken(token);
}

// Statuses are saved either as keys ("POSTPONE_APPOINTMENT") or labels ("Postpone Appointment").
const norm = (v: unknown) => (v == null ? '' : String(v).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_'));

// A lead stays "interested" once it moves past the cold-call stages.
const NOT_INTERESTED_STATUSES = new Set(['', 'NEW', 'NEW_LEAD', 'NOT_INTERESTED', 'CALL_NOT_RECEIVED', 'LOST']);
const APPOINTMENT_STATUSES = new Set(['BOOKING_APPOINTMENT', 'ASSIGNED_APPOINTMENT', 'CANCEL_APPOINTMENT', 'POSTPONE_APPOINTMENT']);
const isBackend = (t: unknown) => ['BACKEND', 'BACKEND_TEAM'].includes(norm(t));
const isExecutive = (t: unknown) => ['EXECUTIVE', 'EXECUTIVE_TEAM'].includes(norm(t));

function leadDate(lead: any): Date | null {
  const raw = lead.leadDate || lead.createdAt || lead.createdDate;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

const idOf = (v: unknown) => (v == null ? '' : String(v));

export async function GET(request: Request) {
  const user = getAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const from = fromParam ? new Date(`${fromParam}T00:00:00.000Z`) : null;
    const to = toParam ? new Date(`${toParam}T23:59:59.999Z`) : null;

    const [users, leads] = await Promise.all([
      db.collection('users').find(
        { roles: { $in: ['calling', 'executive', 'backend'] } },
        { projection: { firstName: 1, lastName: 1, roles: 1 } },
      ).toArray(),
      db.collection('leads').find({}, {
        projection: {
          leadDate: 1, createdAt: 1, createdDate: 1, leadStatus: 1, isAppointment: 1, appointmentTime: 1,
          createdByUserId: 1, createdByUserName: 1, assignedToUserId: 1, assignedToUserName: 1,
          transitLevel: 1, visibleToTeams: 1, forwardedHistory: 1, backendStatus: 1,
          'agreement.status': 1, 'client.clientType': 1,
        },
      }).toArray(),
    ]);

    const nameOf = (u: any) => `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown';
    const byRole = (role: string) => users.filter((u: any) => (u.roles || []).includes(role));

    type CallingRow = { name: string; leadCreated: number; interested: number; appointment: number; sentToExecutive: number; cancelled: number };
    type ExecRow = { name: string; appointment: number; leadCreated: number; cancelled: number; postponed: number };
    type BackRow = { name: string; totalWork: number; submitted: number; completed: number; pending: number };
    type TypeRow = { date: string; agent: number; owner: number; tenant: number; other: number };
    type DayRow = { date: string; totalLeads: number; appointment: number; totalWork: number; submitted: number; completed: number; pending: number };

    // Seed every team member so people with zero activity still show up.
    const calling = new Map<string, CallingRow>();
    for (const u of byRole('calling')) calling.set(u._id.toString(), { name: nameOf(u), leadCreated: 0, interested: 0, appointment: 0, sentToExecutive: 0, cancelled: 0 });
    const executive = new Map<string, ExecRow>();
    for (const u of byRole('executive')) executive.set(u._id.toString(), { name: nameOf(u), appointment: 0, leadCreated: 0, cancelled: 0, postponed: 0 });
    const backOffice = new Map<string, BackRow>();
    for (const u of byRole('backend')) backOffice.set(u._id.toString(), { name: nameOf(u), totalWork: 0, submitted: 0, completed: 0, pending: 0 });

    const clientTypeByDay = new Map<string, TypeRow>();
    const agreementByDay = new Map<string, DayRow>();

    for (const lead of leads as any[]) {
      const d = leadDate(lead);
      if (from && (!d || d < from)) continue;
      if (to && (!d || d > to)) continue;

      const status = norm(lead.leadStatus);
      const history: any[] = Array.isArray(lead.forwardedHistory) ? lead.forwardedHistory : [];
      const cancelled = status === 'CANCEL_APPOINTMENT' || norm(lead.agreement?.status) === 'CANCELLED';
      const postponed = status === 'POSTPONE_APPOINTMENT';
      const hasAppointment = !!lead.isAppointment || !!lead.appointmentTime || APPOINTMENT_STATUSES.has(status);
      const sentToExecutive = isExecutive(lead.transitLevel) || history.some((h) => isExecutive(h?.toTeam));
      const reachedBackend = isBackend(lead.transitLevel)
        || (lead.visibleToTeams || []).some(isBackend)
        || history.some((h) => isBackend(h?.toTeam))
        || !!lead.backendStatus;
      const backendStatus = norm(lead.backendStatus);
      const completed = backendStatus === 'COMPLETED';
      const submitted = completed || backendStatus === 'SUBMITTED';

      // 1. Calling girl — leads she created and how far they progressed.
      const creatorId = idOf(lead.createdByUserId);
      const c = calling.get(creatorId);
      if (c) {
        c.leadCreated++;
        if (!NOT_INTERESTED_STATUSES.has(status)) c.interested++;
        if (hasAppointment) c.appointment++;
        if (sentToExecutive) c.sentToExecutive++;
        if (cancelled) c.cancelled++;
      }

      // 2. Executive — leads created by them, plus every appointment they handled
      // (currently assigned to them, assigned via a forward, or forwarded on by them).
      const execCreator = executive.get(creatorId);
      if (execCreator) execCreator.leadCreated++;
      const handledBy = new Set<string>();
      const assignee = idOf(lead.assignedToUserId);
      if (executive.has(assignee)) handledBy.add(assignee);
      for (const h of history) {
        const a = idOf(h?.assignedToUserId);
        if (isExecutive(h?.toTeam) && executive.has(a)) handledBy.add(a);
        const by = idOf(h?.forwardedByUserId);
        if (isExecutive(h?.fromTeam) && executive.has(by)) handledBy.add(by);
      }
      for (const id of Array.from(handledBy)) {
        const e = executive.get(id)!;
        e.appointment++;
        if (cancelled) e.cancelled++;
        if (postponed) e.postponed++;
      }

      // 3. Back office — the backend employee the lead is (or was last) assigned to.
      if (reachedBackend) {
        let owner = backOffice.has(assignee) ? assignee : '';
        if (!owner) {
          for (let i = history.length - 1; i >= 0; i--) {
            const a = idOf(history[i]?.assignedToUserId);
            if (isBackend(history[i]?.toTeam) && backOffice.has(a)) { owner = a; break; }
          }
        }
        if (!owner) {
          owner = 'UNASSIGNED';
          if (!backOffice.has(owner)) backOffice.set(owner, { name: 'Unassigned', totalWork: 0, submitted: 0, completed: 0, pending: 0 });
        }
        const b = backOffice.get(owner)!;
        b.totalWork++;
        if (submitted) b.submitted++;
        if (completed) b.completed++;
        else b.pending++;
      }

      if (!d) continue;
      const day = d.toISOString().slice(0, 10);

      // 4. Date-wise client type split.
      const t = clientTypeByDay.get(day) || { date: day, agent: 0, owner: 0, tenant: 0, other: 0 };
      const type = norm(lead.client?.clientType);
      if (type === 'AGENT') t.agent++;
      else if (type === 'OWNER') t.owner++;
      else if (type === 'TENANT') t.tenant++;
      else t.other++;
      clientTypeByDay.set(day, t);

      // 5. Date-wise agreement pipeline.
      const a = agreementByDay.get(day) || { date: day, totalLeads: 0, appointment: 0, totalWork: 0, submitted: 0, completed: 0, pending: 0 };
      a.totalLeads++;
      if (hasAppointment) a.appointment++;
      if (reachedBackend) {
        a.totalWork++;
        if (submitted) a.submitted++;
        if (completed) a.completed++;
        else a.pending++;
      }
      agreementByDay.set(day, a);
    }

    const byName = <T extends { name: string }>(m: Map<string, T>) =>
      Array.from(m.values()).sort((x, y) => x.name.localeCompare(y.name));
    const byDateDesc = <T extends { date: string }>(m: Map<string, T>) =>
      Array.from(m.values()).sort((x, y) => y.date.localeCompare(x.date));

    return NextResponse.json({
      calling: byName(calling),
      executive: byName(executive),
      backOffice: byName(backOffice),
      clientTypeByDay: byDateDesc(clientTypeByDay),
      agreementByDay: byDateDesc(agreementByDay),
    });
  } catch (error) {
    console.error('Team reports GET error:', error);
    return NextResponse.json({ error: 'Failed to build team reports' }, { status: 500 });
  }
}
