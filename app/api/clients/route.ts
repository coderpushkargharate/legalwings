import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export async function GET(request: Request) {
  const token = getTokenFromHeaders(request);
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const clientType = searchParams.get('clientType');
    const searchText = searchParams.get('searchText');
    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const filter: Record<string, unknown> = {};
    if (clientType) filter.clientType = clientType;
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
        clientType: 1, cityName: 1, areaName: 1, birthDate: 1,
        aadharNumber: 1, panNumber: 1, createdAt: 1 
      })
      .toArray();

    return NextResponse.json({
      clientPage: {
        content: clients.map(c => ({ 
          id: c._id.toString(), 
          _id: undefined, 
          ...c 
        })),
        totalElements: total,
        totalPages: Math.ceil(total / pageSize),
        number: page,
      },
    });
  } catch (error) {
    console.error('Clients GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const token = getTokenFromHeaders(request);
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    const body = await request.json();

    // Validate required fields
    if (!body.firstName || !body.lastName || !body.phoneNo) {
      return NextResponse.json({ error: 'First name, last name, and phone are required' }, { status: 400 });
    }

    // Check for duplicate phone number
    const existing = await db.collection('clients').findOne({ phoneNo: body.phoneNo });
    if (existing) {
      return NextResponse.json({ 
        error: 'Client with this phone number already exists',
        existingClient: { id: existing._id.toString(), ...existing }
      }, { status: 409 });
    }

    const client = {
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      phoneNo: body.phoneNo,
      email: body.email?.trim() || '',
      clientType: body.clientType || 'OWNER',
      cityName: body.cityName?.trim() || '',
      areaName: body.areaName?.trim() || '',
      birthDate: body.birthDate || '',
      aadharNumber: body.aadharNumber?.trim() || '',
      panNumber: body.panNumber?.trim() || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('clients').insertOne(client);
    
    // Return properly formatted response
    const newClient = {
      id: result.insertedId.toString(),
      ...client,
      _id: undefined,
    };

    return NextResponse.json(newClient, { status: 201 });
  } catch (error: any) {
    console.error('Client POST error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to create client' 
    }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const token = getTokenFromHeaders(request);
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    // Clean and validate update data
    const cleanedUpdate: Record<string, any> = {};
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && updateData[key] !== null) {
        cleanedUpdate[key] = typeof updateData[key] === 'string' 
          ? updateData[key].trim() 
          : updateData[key];
      }
    });

    // Remove protected fields
    delete cleanedUpdate._id;
    delete cleanedUpdate.id;
    delete cleanedUpdate.createdAt;

    cleanedUpdate.updatedAt = new Date();

    const result = await db.collection('clients').updateOne(
      { _id: new ObjectId(id) },
      { $set: cleanedUpdate }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Fetch and return updated client
    const updatedClient = await db.collection('clients').findOne({ _id: new ObjectId(id) });
    
    return NextResponse.json({
      message: 'Client updated successfully',
      client: updatedClient ? { id: updatedClient._id.toString(), ...updatedClient, _id: undefined } : null
    });
  } catch (error: any) {
    console.error('Client PUT error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update client' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const token = getTokenFromHeaders(request);
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    const result = await db.collection('clients').deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Client deleted successfully' });
  } catch (error: any) {
    console.error('Client DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete client' }, { status: 500 });
  }
}