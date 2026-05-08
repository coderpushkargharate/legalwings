import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders, JWTPayload } from '@/lib/auth';
import { ObjectId } from 'mongodb';

function getAuth(request: Request): JWTPayload | null {
  const token = getTokenFromHeaders(request);
  if (!token) return null;
  return verifyToken(token);
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

    // 🔹 RBAC: Employees only see their own leads. Admin & Accounting see ALL.
    const isAdmin = user.roles?.includes('admin');
    const isAccounting = user.roles?.includes('accounting');
    
    if (!isAdmin && !isAccounting && !viewAll) {
      filter.createdByUserId = user.userId;
    }

    // Single lead view
    if (id) {
      const lead = await db.collection('leads').findOne({ _id: new ObjectId(id), ...filter });
      if (!lead) return NextResponse.json({ error: 'Lead not found or access denied' }, { status: 404 });
      return NextResponse.json({ ...lead, id: lead._id.toString(), _id: undefined });
    }

    // Apply existing filters
    const transitLevel = searchParams.get('transitLevel');
    const clientType = searchParams.get('clientType');
    const leadStatus = searchParams.get('leadStatus');
    const searchText = searchParams.get('searchText');
    const cityId = searchParams.get('cityId');
    const areaId = searchParams.get('areaId');

    if (transitLevel && transitLevel !== 'ALL') filter.transitLevel = transitLevel;
    if (clientType) filter['client.clientType'] = clientType;
    if (leadStatus) filter.leadStatus = leadStatus;
    if (cityId) filter['city.id'] = cityId;
    if (areaId) filter['area.id'] = areaId;
    if (searchText) {
      filter.$or = [
        { 'client.firstName': { $regex: searchText, $options: 'i' } },
        { 'client.lastName': { $regex: searchText, $options: 'i' } },
        { 'client.phoneNo': { $regex: searchText, $options: 'i' } },
      ];
    }

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

    // 🔹 Automatically attach creator ID & Name
    const lead = {
      ...body,
      createdByUserId: user.userId,
      createdByUserName: `${user.firstName} ${user.lastName}`,
      updatedByUserId: user.userId,
      updatedByUserName: `${user.firstName} ${user.lastName}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('leads').insertOne(lead);
    return NextResponse.json({ ...lead, id: result.insertedId.toString() }, { status: 201 });
  } catch (error) {
    console.error('Lead POST error:', error);
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
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

    await db.collection('leads').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    return NextResponse.json({ message: 'Lead updated successfully' });
  } catch (error) {
    console.error('Lead PUT error:', error);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}