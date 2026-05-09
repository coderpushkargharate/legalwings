// app/api/public/leads/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: Request) {
  // 🔐 1. API Key Authentication (JWT nahi chahiye yahan)
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.EXTERNAL_LEADS_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized: Invalid or missing API Key' }, { status: 401 });
  }

  // 📥 2. Parse & Basic Validation
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const {
    firstName,
    lastName = '',
    phoneNo,
    email = '',
    clientType = 'OWNER',
    leadSource = 'EXTERNAL_WEBSITE',
    address = '',
    description = ''
  } = body;

  if (!firstName || !phoneNo) {
    return NextResponse.json({ error: 'firstName and phoneNo are required' }, { status: 400 });
  }

  // 📝 3. Format Lead Data (Matches your existing schema)
  const leadData = {
    client: { firstName, lastName, phoneNo, email, clientType },
    leadSource,
    leadStatus: 'NEW_LEAD',
    transitLevel: 'CALLING_TEAM', // Automatically goes to calling queue
    visitAddress: address,
    description,
    createdByUserName: 'External API',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 💾 4. Insert to MongoDB
  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('leads').insertOne(leadData);

    return NextResponse.json({
      success: true,
      leadId: result.insertedId.toString(),
      message: 'Lead created successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Public lead creation error:', error);
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}