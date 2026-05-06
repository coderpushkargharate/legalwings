import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export async function POST(request: Request) {
  const token = getTokenFromHeaders(request);
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    const body = await request.json();

    const agreement = {
      ...body,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('agreements').insertOne(agreement);

    // Update the lead with agreement reference
    if (body.leadId) {
      await db.collection('leads').updateOne(
        { _id: new ObjectId(body.leadId) },
        { $set: { agreement: { ...agreement, id: result.insertedId.toString() }, updatedAt: new Date() } }
      );
    }

    return NextResponse.json({ ...agreement, id: result.insertedId.toString() }, { status: 201 });
  } catch (error) {
    console.error('Agreement POST error:', error);
    return NextResponse.json({ error: 'Failed to create agreement' }, { status: 500 });
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

    if (!id) return NextResponse.json({ error: 'Agreement ID is required' }, { status: 400 });

    updateData.updatedAt = new Date();
    await db.collection('agreements').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    return NextResponse.json({ message: 'Agreement updated successfully' });
  } catch (error) {
    console.error('Agreement PUT error:', error);
    return NextResponse.json({ error: 'Failed to update agreement' }, { status: 500 });
  }
}
