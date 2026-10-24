import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders, JWTPayload } from '@/lib/auth';
import { reportDateOf } from '@/lib/date-utils';

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
const isShop = (t: unknown) => ['SHOP', 'SHOP_TEAM'].includes(norm(t));
const isCalling = (t: unknown) => ['CALLING', 'CALLING_TEAM'].includes(norm(t));
// The Executive report covers the field executives AND the Notary Shop.
const isExecOrShop = (t: unknown) => isExecutive(t) || isShop(t);

// Same date the "Total Leads" card uses, so every report agrees on the lead count.
const leadDate = reportDateOf;

const idOf = (v: unknown) => (v == null ? '' : String(v));
const UNASSIGNED = 'UNASSIGNED';

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
        // Deactivated / deleted employees are left out, same as the Employees list.
        // Their leads still count, under "Unassigned / Admin", so totals never drop.
        { roles: { $in: ['calling', 'executive', 'backend', 'shop'] }, isActive: { $ne: false } },
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

    type CallingRow = { name: string; leadCreated: number; interested: number; appointment: number; sentToExecutive: number; pendingAppointment: number; cancelled: number };
    type ExecRow = {
      name: string; appointment: number; leadCreated: number;
      sentToBackend: number; sentToCalling: number;
      firstVisit: number; secondVisit: number; cancelPostpone: number; otherReason: number;
    };
    type BackRow = { name: string; totalWork: number; submitted: number; completed: number; pending: number };
    type TypeRow = { date: string; agent: number; owner: number; tenant: number; other: number };
    type DayRow = { date: string; totalLeads: number; appointment: number; totalWork: number; submitted: number; completed: number; pending: number };

    // Seed every team member so people with zero activity still show up.
    const newCallingRow = (name: string): CallingRow => ({ name, leadCreated: 0, interested: 0, appointment: 0, sentToExecutive: 0, pendingAppointment: 0, cancelled: 0 });
    const calling = new Map<string, CallingRow>();
    for (const u of byRole('calling')) calling.set(u._id.toString(), newCallingRow(nameOf(u)));

    const newExecRow = (name: string): ExecRow => ({
      name, appointment: 0, leadCreated: 0, sentToBackend: 0, sentToCalling: 0,
      firstVisit: 0, secondVisit: 0, cancelPostpone: 0, otherReason: 0,
    });
    const executive = new Map<string, ExecRow>();
    for (const u of byRole('executive')) executive.set(u._id.toString(), newExecRow(nameOf(u)));
    // Notary Shop employees get their own rows in the Executive report.
    for (const u of byRole('shop')) {
      if (!executive.has(u._id.toString())) executive.set(u._id.toString(), newExecRow(nameOf(u)));
    }
    // Some older leads only stored the creator's name — match those by name.
    const execIdByName = new Map<string, string>();
    for (const [id, row] of Array.from(executive.entries())) execIdByName.set(norm(row.name), id);
    const execRow = (id: string) => {
      if (!executive.has(id)) executive.set(id, newExecRow('Unassigned / Admin'));
      return executive.get(id)!;
    };

    const backOffice = new Map<string, BackRow>();
    for (const u of byRole('backend')) backOffice.set(u._id.toString(), { name: nameOf(u), totalWork: 0, submitted: 0, completed: 0, pending: 0 });

    const inRange = (raw: unknown) => {
      const d = raw ? new Date(raw as any) : null;
      if (!d || isNaN(d.getTime())) return !from && !to;
      return (!from || d >= from) && (!to || d <= to);
    };

    const clientTypeByDay = new Map<string, TypeRow>();
    const agreementByDay = new Map<string, DayRow>();

    for (const lead of leads as any[]) {
      // Executive / Shop forwards are counted on the day they were SENT (forwardedAt), not
      // the lead's created date — so an old lead sent to Backend today counts for today.
      const fwd: any[] = Array.isArray(lead.forwardedHistory) ? lead.forwardedHistory : [];
      fwd.forEach((h, i) => {
        if (!isExecOrShop(h?.fromTeam) || !inRange(h?.forwardedAt)) return;
        const toBackend = isBackend(h?.toTeam);
        const toCalling = isCalling(h?.toTeam);
        if (!toBackend && !toCalling) return;
        // Credit the person who forwarded it; if an admin forwarded on their behalf,
        // credit the executive / shop employee the lead was last assigned to.
        let execId = executive.has(idOf(h?.forwardedByUserId)) ? idOf(h?.forwardedByUserId) : '';
        for (let j = i - 1; !execId && j >= 0; j--) {
          const a = idOf(fwd[j]?.assignedToUserId);
          if (isExecOrShop(fwd[j]?.toTeam) && executive.has(a)) execId = a;
        }
        const e = execRow(execId || UNASSIGNED);
        if (toBackend) { e.sentToBackend++; return; }
        e.sentToCalling++;
        const r = norm(h?.reason);
        if (r === '1ST_VISIT') e.firstVisit++;
        else if (r === '2ND_VISIT') e.secondVisit++;
        else if (r.startsWith('CANCEL') || r.startsWith('POSTPONE')) e.cancelPostpone++;
        else e.otherReason++;
      });

      const d = leadDate(lead);
      if (from && (!d || d < from)) continue;
      if (to && (!d || d > to)) continue;

      const status = norm(lead.leadStatus);
      const history = fwd;
      const cancelled = status === 'CANCEL_APPOINTMENT' || norm(lead.agreement?.status) === 'CANCELLED';
      const hasAppointment = !!lead.isAppointment || !!lead.appointmentTime || APPOINTMENT_STATUSES.has(status);
      const sentToExecutive = isExecutive(lead.transitLevel) || history.some((h) => isExecutive(h?.toTeam));
      const reachedBackend = isBackend(lead.transitLevel)
        || (lead.visibleToTeams || []).some(isBackend)
        || history.some((h) => isBackend(h?.toTeam))
        || !!lead.backendStatus;
      const backendStatus = norm(lead.backendStatus);
      const completed = backendStatus === 'COMPLETED';
      const submitted = completed || backendStatus === 'SUBMITTED';
      const creatorId = idOf(lead.createdByUserId);
      const assignee = idOf(lead.assignedToUserId);

      // 1. Calling team — every lead counts exactly once: under the calling girl who
      // created it, or under "Unassigned / Admin". So the Total row = all leads.
      const c = calling.get(creatorId) || (() => {
        if (!calling.has(UNASSIGNED)) calling.set(UNASSIGNED, newCallingRow('Unassigned / Admin'));
        return calling.get(UNASSIGNED)!;
      })();
      c.leadCreated++;
      if (!NOT_INTERESTED_STATUSES.has(status)) c.interested++;
      if (hasAppointment) c.appointment++;
      if (sentToExecutive) c.sentToExecutive++;
      // Still waiting in the Appointment list (not yet sent to Executive / Backend).
      if (hasAppointment && !sentToExecutive && !reachedBackend && !cancelled) c.pendingAppointment++;
      if (cancelled) c.cancelled++;

      // 2. Executive report (executives + Notary Shop).
      const creatorExec = executive.has(creatorId) ? creatorId : (execIdByName.get(norm(lead.createdByUserName)) || '');
      if (creatorExec) executive.get(creatorExec)!.leadCreated++;
      // Each appointment counts for exactly ONE person — whoever handled it last
      // (current assignee, then forward history, then creator), else "Unassigned / Admin".
      // So the Appointment total here = the Appointment total in the other reports.
      if (hasAppointment) {
        let owner = executive.has(assignee) ? assignee : '';
        for (let i = history.length - 1; !owner && i >= 0; i--) {
          const h = history[i];
          const a = idOf(h?.assignedToUserId);
          const by = idOf(h?.forwardedByUserId);
          if (isExecOrShop(h?.toTeam) && executive.has(a)) owner = a;
          else if (isExecOrShop(h?.fromTeam) && executive.has(by)) owner = by;
        }
        if (!owner) owner = creatorExec;
        execRow(owner || UNASSIGNED).appointment++;
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
          owner = UNASSIGNED;
          if (!backOffice.has(owner)) backOffice.set(owner, { name: 'Unassigned', totalWork: 0, submitted: 0, completed: 0, pending: 0 });
        }
        const b = backOffice.get(owner)!;
        b.totalWork++;
        if (submitted) b.submitted++;
        if (completed) b.completed++;
        else b.pending++;
      }

      // Leads always have a date unless every date field is missing/garbled; keep them
      // in the day-wise totals anyway so those totals still match the other reports.
      const day = d ? d.toISOString().slice(0, 10) : 'No date';

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

    // Alphabetical, with the "Unassigned" catch-all row last.
    const byName = <T extends { name: string }>(m: Map<string, T>) =>
      Array.from(m.entries())
        .sort(([ka, x], [kb, y]) => (Number(ka === UNASSIGNED) - Number(kb === UNASSIGNED)) || x.name.localeCompare(y.name))
        .map(([, v]) => v);
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
