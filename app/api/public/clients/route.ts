// app/api/public/clients/route.ts
// External Developer API — Clients dropdown / search
//   GET  /api/public/clients                       → paginated clients
//   GET  /api/public/clients?searchText=ravi        → search name/email/phone
//   GET  /api/public/clients?clientType=OWNER       → filter by type
//   POST /api/public/clients                        → create a client
// Auth: x-api-key header.
import { connectToDatabase } from '@/lib/mongodb';
import { requireApiKey, jsonResponse, handleOptions } from '@/lib/publicApi';

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const clientType = searchParams.get('clientType');
    const searchText = searchParams.get('searchText');
    const page = Math.max(0, parseInt(searchParams.get('page') || '0'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));

    const filter: Record<string, unknown> = {};
    if (clientType) filter.clientType = clientType.toUpperCase();
    if (searchText) {
      filter.$or = [
        { firstName: { $regex: searchText, $options: 'i' } },
        { lastName: { $regex: searchText, $options: 'i' } },
        { email: { $regex: searchText, $options: 'i' } },
        { phoneNo: { $regex: searchText, $options: 'i' } },
      ];
    }

    const total = await db.collection('clients').countDocuments(filter);
    const clients = await db.collection('clients')
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(page * pageSize)
      .limit(pageSize)
      .project({
        _id: 1, firstName: 1, lastName: 1, email: 1, phoneNo: 1,
        clientType: 1, cityName: 1, areaName: 1,
      })
      .toArray();

    return jsonResponse(request, {
      success: true,
      content: clients.map(c => ({ id: c._id.toString(), _id: undefined, ...c })),
      totalElements: total,
      totalPages: Math.ceil(total / pageSize),
      page,
      pageSize,
    });
  } catch (error) {
    console.error('Public clients GET error:', error);
    return jsonResponse(request, { error: 'Failed to fetch clients' }, 500);
  }
}

export async function POST(request: Request) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: 'Invalid JSON payload' }, 400);
  }

  if (!body.firstName || !body.phoneNo) {
    return jsonResponse(request, { error: 'firstName and phoneNo are required' }, 400);
  }

  try {
    const { db } = await connectToDatabase();
    const existing = await db.collection('clients').findOne({ phoneNo: body.phoneNo });
    if (existing) {
      return jsonResponse(request, {
        error: 'Client with this phone number already exists',
        existingClient: { id: existing._id.toString(), ...existing, _id: undefined },
      }, 409);
    }

    const client = {
      firstName: String(body.firstName).trim(),
      lastName: String(body.lastName || '').trim(),
      phoneNo: body.phoneNo,
      email: body.email?.trim() || '',
      clientType: body.clientType || 'OWNER',
      cityName: body.cityName?.trim() || '',
      areaName: body.areaName?.trim() || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('clients').insertOne(client);
    return jsonResponse(request, { success: true, id: result.insertedId.toString(), ...client }, 201);
  } catch (error: any) {
    console.error('Public client POST error:', error);
    return jsonResponse(request, { error: error.message || 'Failed to create client' }, 500);
  }
}
