import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';

export async function GET(request: Request) {
  const token = getTokenFromHeaders(request);
  if (!token || !verifyToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const teamFilter = searchParams.get('team'); // Optional: filter by team

    const filter: Record<string, any> = { roles: { $ne: 'admin' } };
    
    // 🔹 Filter by team if specified
    if (teamFilter) {
      const roleMap: Record<string, string> = {
        'Calling': 'calling', 'Executive': 'executive', 'Backend': 'backend',
        'Accounts': 'accounting', 'Marketing': 'marketing'
      };
      const teamRole = roleMap[teamFilter] || teamFilter.toLowerCase();
      filter.roles = { $in: ['employee', teamRole] };
      filter.team = teamFilter;
    }

    const users = await db.collection('users').find(filter).toArray();
    
    return NextResponse.json({
      employees: users.map(u => ({
        id: u._id.toString(),
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        team: u.team || 'Unknown',
        roles: u.roles,
        createdAt: u.createdAt
      }))
    });
  } catch (error) {
    console.error('Employees GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const token = getTokenFromHeaders(request);
  if (!token || !verifyToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { db } = await connectToDatabase();
    const body = await request.json();
    const { firstName, lastName, email, password, team } = body;

    if (!email || !password || !firstName || !team) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const existing = await db.collection('users').findOne({ email });
    if (existing) return NextResponse.json({ error: 'Email already exists' }, { status: 409 });

    const hashedPassword = await bcrypt.hash(password, 12);
    const roleMap: Record<string, string> = {
      'Calling': 'calling', 'Executive': 'executive', 'Backend': 'backend',
      'Accounts': 'accounting', 'Marketing': 'marketing'
    };

    const result = await db.collection('users').insertOne({
      firstName,
      lastName: lastName || '',
      email,
      password: hashedPassword,
      roles: ['employee', roleMap[team] || 'employee'],
      team,
      createdAt: new Date()
    });

    return NextResponse.json({ 
      message: 'Employee created successfully', 
      id: result.insertedId.toString(),
      employee: {
        id: result.insertedId.toString(),
        firstName,
        lastName: lastName || '',
        email,
        team,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Employee POST error:', error);
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const token = getTokenFromHeaders(request);
  if (!token || !verifyToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });

    await db.collection('users').deleteOne({ _id: new ObjectId(id) });
    return NextResponse.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Employee DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
}