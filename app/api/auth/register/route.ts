import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password, firstName, lastName } = await request.json();

    if (!email || !password || !firstName) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const existing = await db.collection('users').findOne({ email });

    if (existing) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await db.collection('users').insertOne({
      email,
      password: hashedPassword,
      firstName,
      lastName: lastName || '',
      roles: ['admin'],
      createdAt: new Date(),
    });

    const token = signToken({
      userId: result.insertedId.toString(),
      email,
      firstName,
      lastName: lastName || '',
      roles: ['admin'],
    });

    return NextResponse.json({
      token,
      user: { id: result.insertedId, email, firstName, lastName: lastName || '', roles: ['admin'] },
    }, { status: 201 });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
