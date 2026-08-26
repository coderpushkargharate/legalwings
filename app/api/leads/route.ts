import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders, JWTPayload } from '@/lib/auth';
import { ObjectId } from 'mongodb';

function getAuth(request: Request): JWTPayload | null {
  const token = getTokenFromHeaders(request);
  if (!token) return null;
  return verifyToken(token);
}

// ✅ Helper: combine independent OR-groups with AND semantics.
// Each call adds one `{ $or: [...] }` clause to the shared `$and` array so that
// separate filters (access-control, search text, mobile, etc.) NARROW the result
// set instead of accidentally widening it by appending into a single `$or`.
function addOrGroup(andConditions: Record<string, unknown>[], conditions: Record<string, unknown>[]) {
  if (conditions.length) andConditions.push({ $or: conditions });
}

// ✅ Helper: Validate and convert string to ObjectId
function toObjectId(id: string | null): ObjectId | null {
  if (!id || !ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

// ✅ Helper: escape user input before embedding it in a RegExp
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ✅ Helper: build a MongoDB range condition ($gte/$lte) for a from/to date pair.
// `from`/`to` arrive as `YYYY-MM-DD` strings. Two field kinds exist:
//   - Date-object fields (createdAt / updatedAt) stored via `new Date()` → compare with Date objects.
//   - ISO-string fields (appointmentTime, agreement.*, follow-up dates) → compare with strings.
// The upper bound is pushed to end-of-day so same-day records are included.
// ⚠️ Date-object boundaries are built in UTC (trailing `Z`). The frontend derives its
// default "today" via `new Date().toISOString()` (a UTC calendar date), so the backend
// MUST use UTC day boundaries too — otherwise, on a server whose local timezone is not
// UTC, a just-created lead falls outside "today" and vanishes from the team's default view.
function addDateRange(
  filter: Record<string, unknown>,
  field: string,
  from: string | null,
  to: string | null,
  isDateObject = false,
) {
  if (!from && !to) return;
  const range: Record<string, unknown> = {};
  if (from) range.$gte = isDateObject ? new Date(`${from}T00:00:00.000Z`) : from;
  if (to) range.$lte = isDateObject ? new Date(`${to}T23:59:59.999Z`) : `${to}T23:59:59.999`;
  filter[field] = range;
}

// ✅ External CRM integration sends a lean shape (no agreement/payment/history
// blobs). Strip the lead down to the core fields the external service needs.
function toLeanLead(l: Record<string, unknown>) {
  return {
    id: (l._id as ObjectId).toString(),
    client: l.client,
    leadStatus: l.leadStatus,
    leadSource: l.leadSource,
    leadDate: l.leadDate,
    transitLevel: l.transitLevel,
    city: l.city,
    area: l.area,
    createdByUserId: l.createdByUserId,
    createdByUserName: l.createdByUserName,
    updatedByUserId: l.updatedByUserId,
    updatedByUserName: l.updatedByUserName,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    visibleToTeams: l.visibleToTeams,
  };
}

export async function GET(request: Request) {
  const user = getAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const viewAll = searchParams.get('viewAll') === 'true';
    const filter: Record<string, unknown> = {};
    // Independent OR-groups are collected here and combined with AND at the end.
    const andConditions: Record<string, unknown>[] = [];

    const isAdmin = user.roles?.includes('admin') || user.roles?.includes('ADMIN');
    const isAccounting = user.roles?.includes('accounting') || user.roles?.includes('ACCOUNTING');

    // 🔐 Team-based access control — kept as its own OR-group so search/filter
    // OR-groups can never widen it back open.
    if (!isAdmin && !isAccounting && !viewAll) {
      // 🔐 Per-employee isolation: a regular employee sees ONLY the leads they
      // personally created, plus any lead that was forwarded/assigned specifically
      // to them (assignedToUserId). They do NOT see other employees' leads or the
      // shared team queue — the full team view stays with admins (and the
      // accounting / "All" dashboards) only.
      //
      // This also gives the desired forwarding behavior: when an Executive employee
      // forwards a lead they were assigned back to Calling/Backend, the assign-team
      // route clears assignedToUserId, so the lead drops off that employee's dashboard
      // — while the admin's MAIN dashboard still shows it (it filters by visibleToTeams,
      // which forwarding no longer strips).
      const ownId = toObjectId(user.userId);
      addOrGroup(andConditions, [
        // Leads I created — but once I forward/assign one to a DIFFERENT employee it
        // leaves my dashboard (it stays with admins via the shared team view).
        { $and: [
          { createdByUserId: user.userId },
          { $or: [{ assignedToUserId: null }, { assignedToUserId: ownId }] },
        ] },
        // Leads forwarded/assigned specifically to me.
        { assignedToUserId: ownId },
      ]);
    }

    // 🔍 Single lead view (still subject to the access-control group above)
    if (id) {
      const accessFilter = andConditions.length ? { $and: andConditions } : {};
      const lead = await db.collection('leads').findOne({ _id: new ObjectId(id), ...accessFilter });
      if (!lead) return NextResponse.json({ error: 'Lead not found or access denied' }, { status: 404 });
      // Expose `createdDate` (the UI reads it) derived from the stored `createdAt`.
      return NextResponse.json({ ...lead, id: lead._id.toString(), createdDate: lead.createdDate || lead.createdAt, _id: undefined });
    }

    // 📋 Apply filters
    const transitLevel = searchParams.get('transitLevel');
    const clientType = searchParams.get('clientType');
    // External CRM uses lowercase `usertype`; internal callers use `userType`.
    const userType = searchParams.get('userType') || searchParams.get('usertype');
    const leadStatus = searchParams.get('leadStatus');
    // External CRM uses `number`; internal callers use `mobile`.
    const mobile = searchParams.get('mobile') || searchParams.get('number');

    // External CRM calls are detected by their distinctive param names. They get
    // case-insensitive value matching and a trimmed (lean) response. Internal
    // dashboard calls (which need full agreement/payment data) are unaffected.
    const isExternal = searchParams.has('number') || searchParams.has('usertype');
    const searchText = searchParams.get('searchText');
    const cityId = searchParams.get('cityId');
    const areaId = searchParams.get('areaId');
    const assignedToUserId = searchParams.get('assignedToUserId');
    
    // Backend specific filters
    const ownerName = searchParams.get('ownerName');
    const tenantName = searchParams.get('tenantName');
    // Backend team merged filter: one box that matches Owner OR Tenant name.
    const ownerTenantName = searchParams.get('ownerTenantName');
    const tokenNumber = searchParams.get('tokenNumber');
    const agreementStatus = searchParams.get('agreementStatus');
    const backOfficeStatus = searchParams.get('backOfficeStatus');
    const grnNo = searchParams.get('grnNo');
    const dhcNo = searchParams.get('dhcNo');
    const commissionDate = searchParams.get('commissionDate');
    const commissionAmount = searchParams.get('commissionAmount');
    
    // Accounting specific filters
    const clientName = searchParams.get('clientName');
    const phone = searchParams.get('phone');
    const amount = searchParams.get('amount');
    const status = searchParams.get('status');
    const paymentDate = searchParams.get('paymentDate');
    
    // Marketing specific filters
    const executeDate = searchParams.get('executeDate');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const ownerMobile = searchParams.get('ownerMobile');
    const ownerDob = searchParams.get('ownerDob');
    const tenantMobile = searchParams.get('tenantMobile');
    const tenantDob = searchParams.get('tenantDob');

    // Date-range filters (Calling / Accounting / Marketing dashboards)
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const filterOn = searchParams.get('filterOn') || 'Created Date';
    const appointmentFromDate = searchParams.get('appointmentFromDate');
    const appointmentToDate = searchParams.get('appointmentToDate');
    // Calling team's Appointments tab: show every appointment lead regardless of
    // creation date (so appointments booked on earlier days don't vanish once
    // "today" rolls over past the default Created Date range).
    const isAppointment = searchParams.get('isAppointment');
    const nextFollowUpFromDate = searchParams.get('nextFollowUpFromDate');
    const nextFollowUpToDate = searchParams.get('nextFollowUpToDate');
    const lastFollowUpFromDate = searchParams.get('lastFollowUpFromDate');
    const lastFollowUpToDate = searchParams.get('lastFollowUpToDate');
    const visitCount = searchParams.get('visitCount');

    // ✅ FIX: visibleToTeams query for array field
    if (transitLevel && transitLevel !== 'ALL') {
      const upperTransit = transitLevel.toUpperCase();
      const normalizedTeam = upperTransit.endsWith('_TEAM') 
        ? upperTransit 
        : `${upperTransit}_TEAM`;
      filter.visibleToTeams = { $in: [normalizedTeam] };
    }
    
    // clientType / userType are aliases for the lead contact's type (OWNER/TENANT/AGENT)
    if (clientType) filter['client.clientType'] = clientType;
    if (userType) {
      // External CRM sends values like "owner" / "tenants" — match case-insensitively
      // and tolerate a trailing plural "s" (tenant ⇄ tenants) against stored
      // values such as "Owner" / "Tenant" / "OWNER".
      const root = userType.replace(/s$/i, '');
      filter['client.clientType'] = { $regex: `^${escapeRegex(root)}s?$`, $options: 'i' };
    }
    if (leadStatus) filter.leadStatus = leadStatus;

    // 📱 Mobile filter — matches across every phone field a lead can carry
    if (mobile) {
      addOrGroup(andConditions, [
        { 'client.phoneNo': { $regex: mobile, $options: 'i' } },
        { 'agreement.mobileNo': { $regex: mobile, $options: 'i' } },
        { 'agreement.owner.phoneNo': { $regex: mobile, $options: 'i' } },
        { 'agreement.tenant.phoneNo': { $regex: mobile, $options: 'i' } },
      ]);
    }
    if (cityId) filter['city.id'] = cityId;
    if (areaId) filter['area.id'] = areaId;
    if (assignedToUserId) {
      const objId = toObjectId(assignedToUserId);
      if (objId) filter.assignedToUserId = objId;
    }

    // Backend filters
    if (ownerName) filter['agreement.owner.firstName'] = { $regex: ownerName, $options: 'i' };
    if (tenantName) filter['agreement.tenant.firstName'] = { $regex: tenantName, $options: 'i' };
    // Merged Owner/Tenant name search — matches either party's first or last name.
    if (ownerTenantName) {
      const ot = escapeRegex(ownerTenantName);
      addOrGroup(andConditions, [
        { 'agreement.owner.firstName': { $regex: ot, $options: 'i' } },
        { 'agreement.owner.lastName': { $regex: ot, $options: 'i' } },
        { 'agreement.tenant.firstName': { $regex: ot, $options: 'i' } },
        { 'agreement.tenant.lastName': { $regex: ot, $options: 'i' } },
      ]);
    }
    if (tokenNumber) filter['agreement.tokenNo'] = { $regex: tokenNumber, $options: 'i' };
    if (agreementStatus) filter['agreement.status'] = agreementStatus;
    if (backOfficeStatus) filter['agreement.backOfficeStatus'] = backOfficeStatus;
    if (grnNo) filter['payment.grnNumber'] = { $regex: grnNo, $options: 'i' };
    if (dhcNo) filter['payment.dhcNumber'] = { $regex: dhcNo, $options: 'i' };
    if (commissionDate) filter['payment.commissionDate'] = commissionDate;
    if (commissionAmount) {
      const num = parseFloat(commissionAmount);
      if (!isNaN(num)) filter['payment.commissionAmount'] = num;
    }

    // Accounting filters - ✅ Safe $or merge
    if (clientName) {
      addOrGroup(andConditions, [
        { 'client.firstName': { $regex: clientName, $options: 'i' } },
        { 'client.lastName': { $regex: clientName, $options: 'i' } },
      ]);
    }
    if (phone) filter['client.phoneNo'] = { $regex: phone, $options: 'i' };
    if (amount) {
      const num = parseFloat(amount);
      if (!isNaN(num)) filter['payment.totalAmount'] = num;
    }
    if (status) {
      if (isExternal) {
        // External CRM filters on the lead's own status. "pending" means any
        // open lead (not COMPLETED and not CANCELLED); any other value is an
        // exact, case-insensitive leadStatus match.
        if (/^pending$/i.test(status)) {
          filter.leadStatus = { $not: { $regex: '^(completed|cancelled)$', $options: 'i' } };
        } else {
          filter.leadStatus = { $regex: `^${escapeRegex(status)}$`, $options: 'i' };
        }
      } else {
        filter['agreement.status'] = status;
      }
    }
    if (paymentDate) filter['payment.paymentDate'] = paymentDate;
    if (isAppointment === 'true') filter.isAppointment = true;
    // `false` = the Leads list: everything NOT forwarded to Appointments
    // (isAppointment is false or was never set).
    else if (isAppointment === 'false') filter.isAppointment = { $ne: true };

    // Marketing filters
    if (executeDate) filter['agreement.executeDate'] = executeDate;
    if (startDate) filter['agreement.agreementStartDate'] = startDate;
    if (endDate) filter['agreement.agreementEndDate'] = endDate;
    if (ownerMobile) filter['agreement.owner.phoneNo'] = { $regex: ownerMobile, $options: 'i' };
    if (ownerDob) filter['agreement.owner.dateOfBirth'] = ownerDob;
    if (tenantMobile) filter['agreement.tenant.phoneNo'] = { $regex: tenantMobile, $options: 'i' };
    if (tenantDob) filter['agreement.tenant.dateOfBirth'] = tenantDob;

    // 📅 Primary date-range filter — the "From / To Date" + "Filter On" controls.
    // Maps the chosen "Filter On" option to its backing field. createdAt/updatedAt
    // are stored as Date objects; the rest are ISO strings.
    const filterOnField: Record<string, { field: string; isDate: boolean }> = {
      'Created Date': { field: 'createdAt', isDate: true },
      'Updated Date': { field: 'updatedAt', isDate: true },
      'Appointment Date': { field: 'appointmentTime', isDate: false },
      'Agreement Date': { field: 'agreement.agreementStartDate', isDate: false },
    };
    const chosen = filterOnField[filterOn] || filterOnField['Created Date'];
    if (chosen.field === 'createdAt' && (fromDate || toDate)) {
      // A lead can enter a team two ways: it was created there (`createdAt`), or
      // it was forwarded/assigned in later (`forwardedAt`, set by assign-team).
      // The default "Created Date" range must match EITHER — otherwise a lead
      // created on an earlier day but forwarded into this team today is hidden
      // from the destination team's default (today) view, so forwarded leads
      // never surface in Calling/Shop/etc. until the user widens the dates.
      // UTC boundaries (trailing `Z`) to match the frontend's UTC-based "today" — see addDateRange note.
      const range: Record<string, unknown> = {};
      if (fromDate) range.$gte = new Date(`${fromDate}T00:00:00.000Z`);
      if (toDate) range.$lte = new Date(`${toDate}T23:59:59.999Z`);
      addOrGroup(andConditions, [
        { createdAt: range },
        { forwardedAt: range },
      ]);
    } else {
      addDateRange(filter, chosen.field, fromDate, toDate, chosen.isDate);
    }

    // 📅 Secondary date-range filters (appointment / follow-up windows)
    addDateRange(filter, 'appointmentTime', appointmentFromDate, appointmentToDate, false);
    addDateRange(filter, 'nextFollowUpDate', nextFollowUpFromDate, nextFollowUpToDate, false);
    addDateRange(filter, 'lastFollowUpDate', lastFollowUpFromDate, lastFollowUpToDate, false);

    if (visitCount) {
      const vc = parseInt(visitCount, 10);
      if (!isNaN(vc)) filter.visitCount = vc;
    }

    // 🔍 Search text - ✅ Own AND-ed OR-group.
    // Searches client name/phone, agreement token/mobile, and BOTH owner & tenant
    // full name + phone so a single box finds Owner name + Tenant name + mobile.
    if (searchText) {
      const st = escapeRegex(searchText);
      // Match a full "First Last" name against separate first/last name fields.
      const fullName = (first: string, last: string) => ({
        $expr: {
          $regexMatch: {
            input: { $concat: [{ $ifNull: [`$${first}`, ''] }, ' ', { $ifNull: [`$${last}`, ''] }] },
            regex: st,
            options: 'i',
          },
        },
      });
      addOrGroup(andConditions, [
        { 'client.firstName': { $regex: st, $options: 'i' } },
        { 'client.lastName': { $regex: st, $options: 'i' } },
        { 'client.phoneNo': { $regex: st, $options: 'i' } },
        { 'agreement.tokenNo': { $regex: st, $options: 'i' } },
        { 'agreement.mobileNo': { $regex: st, $options: 'i' } },
        { 'agreement.owner.firstName': { $regex: st, $options: 'i' } },
        { 'agreement.owner.lastName': { $regex: st, $options: 'i' } },
        { 'agreement.owner.phoneNo': { $regex: st, $options: 'i' } },
        { 'agreement.tenant.firstName': { $regex: st, $options: 'i' } },
        { 'agreement.tenant.lastName': { $regex: st, $options: 'i' } },
        { 'agreement.tenant.phoneNo': { $regex: st, $options: 'i' } },
        // Full-name matches (First + Last) for client, owner and tenant.
        fullName('client.firstName', 'client.lastName'),
        fullName('agreement.owner.firstName', 'agreement.owner.lastName'),
        fullName('agreement.tenant.firstName', 'agreement.tenant.lastName'),
      ]);
    }

    // Combine all independent OR-groups under a single $and
    if (andConditions.length) filter.$and = andConditions;

    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const total = await db.collection('leads').countDocuments(filter);
    // Omit the large base64 file blobs from the LIST response — they can be several
    // MB per lead and make reloads slow. The table doesn't render them inline; the
    // View modal and the Files dropdown fetch the full lead by id when needed.
    const leads = await db.collection('leads')
      .find(filter, {
        projection: {
          'agreement.fileData': 0,
          'agreement.agreementFile': 0,
          'agreement.pvrFileData': 0,
          'agreement.otherFileData': 0,
        },
      })
      .sort({ createdAt: -1 })
      .skip(page * pageSize)
      .limit(pageSize)
      .toArray();

    return NextResponse.json({
      leadPage: {
        content: isExternal
          ? leads.map(toLeanLead)
          : leads.map(l => ({ ...l, id: l._id.toString(), createdDate: l.createdDate || l.createdAt, _id: undefined })),
        totalElements: total,
        totalPages: Math.ceil(total / pageSize),
        number: page,
      },
    });
  } catch (error) {
    console.error('Leads GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = getAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { db } = await connectToDatabase();
    const body = await request.json();
    
    const userTeam = (((user as JWTPayload & { team?: string }).team) || 'UNKNOWN').toUpperCase();
    const transitLevel = body.transitLevel || `${userTeam}_TEAM`;
    
    const lead = {
      ...body,
      transitLevel,
      createdByUserId: user.userId,
      createdByUserName: `${user.firstName} ${user.lastName}`,
      updatedByUserId: user.userId,
      updatedByUserName: `${user.firstName} ${user.lastName}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      visibleToTeams: [transitLevel], // ✅ Store as array
    };
    
    const result = await db.collection('leads').insertOne(lead);
    return NextResponse.json({ ...lead, id: result.insertedId.toString() }, { status: 201 });
  } catch (error) {
    console.error('Lead POST error:', error);
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}

// ✅ FIXED PUT HANDLER - Protects critical access fields
export async function PUT(request: Request) {
  const user = getAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { db } = await connectToDatabase();
    const body = await request.json();
    const { id, ...updateData } = body;
    if (!id) return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    
    // 🔐 PROTECT CRITICAL FIELDS from modification via the generic edit.
    // Team visibility / assignment / audit fields are owned exclusively by the
    // dedicated assign-team route (which stores assignedToUserId as a real
    // ObjectId and maintains visibleToTeams correctly). The edit modal has no UI
    // to change these, and letting them through here — even for admins — rewrites
    // assignedToUserId as a plain string and clobbers visibleToTeams/transitLevel,
    // which makes the lead drop out of the team-page list query on refresh.
    // So strip them for EVERYONE, not just non-admins.
    const protectedFields = [
      'visibleToTeams',
      'assignedToUserId',
      'assignedToUserName',
      'assignedAt',
      'transitLevel',
      'createdByUserId',
      'createdByUserName',
      'createdAt',
      'forwardedHistory'
    ];

    // Remove protected fields from the update payload regardless of role.
    protectedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        delete updateData[field];
      }
    });
    
    updateData.updatedAt = new Date();
    updateData.updatedByUserId = user.userId;
    updateData.updatedByUserName = `${user.firstName} ${user.lastName}`;
    
    if (updateData._id) delete updateData._id;
    
    const result = await db.collection('leads').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    
    return NextResponse.json({ message: 'Lead updated successfully', id });
  } catch (error) {
    console.error('Lead PUT error:', error);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = getAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { db } = await connectToDatabase();
    const body = await request.json();
    const { id, ...updateData } = body;
    if (!id) return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    
    updateData.updatedAt = new Date();
    updateData.updatedByUserId = user.userId;
    updateData.updatedByUserName = `${user.firstName} ${user.lastName}`;
    
    if (updateData._id) delete updateData._id;
    
    const result = await db.collection('leads').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    
    return NextResponse.json({ message: 'Lead updated successfully', id });
  } catch (error) {
    console.error('Lead PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}

// 🗑️ DELETE — admin-only. Powers the admin dashboard's "All Data Overview" panel.
// Supports three modes:
//   • Single delete  → ?id=<leadId>  (or body { id })
//   • Bulk delete    → body { ids: ["..","..."] }
//   • Delete ALL     → body { all: true }   (wipes every lead — use with care)
export async function DELETE(request: Request) {
  const user = getAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only admins may delete leads from the CRM.
  const isAdmin = user.roles?.includes('admin') || user.roles?.includes('ADMIN');
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });

  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const idFromQuery = searchParams.get('id');

    // Body is optional (single delete can come purely from the query string).
    let body: { id?: string; ids?: string[]; all?: boolean } = {};
    try { body = await request.json(); } catch { /* no body */ }

    // Delete every lead in the collection.
    if (body.all === true) {
      const result = await db.collection('leads').deleteMany({});
      return NextResponse.json({ message: 'All leads deleted', deletedCount: result.deletedCount });
    }

    // Bulk delete a specific set of ids.
    if (Array.isArray(body.ids) && body.ids.length > 0) {
      const objectIds = body.ids
        .map((v) => toObjectId(v))
        .filter((v): v is ObjectId => v !== null);
      if (objectIds.length === 0) {
        return NextResponse.json({ error: 'No valid lead ids provided' }, { status: 400 });
      }
      const result = await db.collection('leads').deleteMany({ _id: { $in: objectIds } });
      return NextResponse.json({ message: 'Leads deleted', deletedCount: result.deletedCount });
    }

    // Single delete.
    const singleId = idFromQuery || body.id;
    const objId = toObjectId(singleId ?? null);
    if (!objId) return NextResponse.json({ error: 'A valid lead id is required' }, { status: 400 });

    const result = await db.collection('leads').deleteOne({ _id: objId });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Lead deleted', deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Lead DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete lead(s)' }, { status: 500 });
  }
}