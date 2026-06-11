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
      const userTeam = (((user as JWTPayload & { team?: string }).team) || 'UNKNOWN').toUpperCase();
      const possibleTeamNames = [userTeam, `${userTeam}_TEAM`, userTeam.replace('_TEAM', '')];
      const ownId = toObjectId(user.userId);

      addOrGroup(andConditions, [
        { createdByUserId: user.userId },
        { assignedToUserId: ownId },
        { visibleToTeams: { $in: possibleTeamNames } },
      ]);
    }

    // 🔍 Single lead view (still subject to the access-control group above)
    if (id) {
      const accessFilter = andConditions.length ? { $and: andConditions } : {};
      const lead = await db.collection('leads').findOne({ _id: new ObjectId(id), ...accessFilter });
      if (!lead) return NextResponse.json({ error: 'Lead not found or access denied' }, { status: 404 });
      return NextResponse.json({ ...lead, id: lead._id.toString(), _id: undefined });
    }

    // 📋 Apply filters
    const transitLevel = searchParams.get('transitLevel');
    const clientType = searchParams.get('clientType');
    const userType = searchParams.get('userType');
    const leadStatus = searchParams.get('leadStatus');
    const mobile = searchParams.get('mobile');
    const searchText = searchParams.get('searchText');
    const cityId = searchParams.get('cityId');
    const areaId = searchParams.get('areaId');
    const assignedToUserId = searchParams.get('assignedToUserId');
    
    // Backend specific filters
    const ownerName = searchParams.get('ownerName');
    const tenantName = searchParams.get('tenantName');
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
    if (userType) filter['client.clientType'] = userType;
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
    if (status) filter['agreement.status'] = status;
    if (paymentDate) filter['payment.paymentDate'] = paymentDate;

    // Marketing filters
    if (executeDate) filter['agreement.executeDate'] = executeDate;
    if (startDate) filter['agreement.agreementStartDate'] = startDate;
    if (endDate) filter['agreement.agreementEndDate'] = endDate;
    if (ownerMobile) filter['agreement.owner.phoneNo'] = { $regex: ownerMobile, $options: 'i' };
    if (ownerDob) filter['agreement.owner.dateOfBirth'] = ownerDob;
    if (tenantMobile) filter['agreement.tenant.phoneNo'] = { $regex: tenantMobile, $options: 'i' };
    if (tenantDob) filter['agreement.tenant.dateOfBirth'] = tenantDob;

    // 🔍 Search text - ✅ Own AND-ed OR-group
    if (searchText) {
      addOrGroup(andConditions, [
        { 'client.firstName': { $regex: searchText, $options: 'i' } },
        { 'client.lastName': { $regex: searchText, $options: 'i' } },
        { 'client.phoneNo': { $regex: searchText, $options: 'i' } },
        { 'agreement.tokenNo': { $regex: searchText, $options: 'i' } },
        { 'agreement.owner.firstName': { $regex: searchText, $options: 'i' } },
        { 'agreement.tenant.firstName': { $regex: searchText, $options: 'i' } },
      ]);
    }

    // Combine all independent OR-groups under a single $and
    if (andConditions.length) filter.$and = andConditions;

    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const total = await db.collection('leads').countDocuments(filter);
    const leads = await db.collection('leads')
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(page * pageSize)
      .limit(pageSize)
      .toArray();

    return NextResponse.json({
      leadPage: {
        content: leads.map(l => ({ ...l, id: l._id.toString(), _id: undefined })),
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