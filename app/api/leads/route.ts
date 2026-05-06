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

    if (id) {
      const lead = await db.collection('leads').findOne({ _id: new ObjectId(id) });
      if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      return NextResponse.json({ ...lead, id: lead._id.toString(), _id: undefined });
    }

    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const transitLevel = searchParams.get('transitLevel');
    const clientType = searchParams.get('clientType');
    const leadStatus = searchParams.get('leadStatus');
    const searchText = searchParams.get('searchText');
    const cityId = searchParams.get('cityId');
    const areaId = searchParams.get('areaId');

    const filter: Record<string, unknown> = {};
    if (transitLevel) filter.transitLevel = transitLevel;
    if (clientType) filter['client.clientType'] = clientType;
    if (leadStatus) filter.leadStatus = leadStatus;
    if (cityId) filter['city.id'] = cityId;
    if (areaId) filter['area.id'] = areaId;
    if (searchText) {
      filter.$or = [
        { 'client.firstName': { $regex: searchText, $options: 'i' } },
        { 'client.lastName': { $regex: searchText, $options: 'i' } },
      ];
    }

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

    const lead = {
      ...body,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByUserName: `${user.firstName} ${user.lastName}`,
      updatedByUserName: `${user.firstName} ${user.lastName}`,
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
