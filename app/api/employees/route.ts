import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';

export async function GET(request: Request) {
  const token = getTokenFromHeaders(request);
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const teamFilter = searchParams.get('team');

    // Base filter: include all employees, exclude admins
    const filter: Record<string, any> = { 
      roles: { $in: ['employee', 'calling', 'executive', 'backend', 'accounting', 'marketing'] },
      isActive: { $ne: false }
    };
    
    // Apply team filter ONLY if specified
    if (teamFilter && teamFilter.trim() !== '') {
      const roleMap: Record<string, string> = {
        'Calling': 'calling', 
        'Executive': 'executive', 
        'Backend': 'backend',
        'Accounts': 'accounting', 
        'Marketing': 'marketing',
        'Accounting': 'accounting'
      };
      const teamRole = roleMap[teamFilter] || teamFilter.toLowerCase();
      
      filter.$or = [
        { team: { $regex: new RegExp(`^${teamFilter}$`, 'i') } },
        { roles: { $in: [teamRole] } }
      ];
    }

    const users = await db.collection('users')
      .find(filter)
      .sort({ firstName: 1, lastName: 1 })
      .toArray();
    
    return NextResponse.json({
      success: true,
      employees: users.map(u => ({
        id: u._id?.toString() || u.id,
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        email: u.email || '',
        team: u.team || 'Unknown',
        roles: u.roles || [],
        createdAt: u.createdAt || new Date(),
        isActive: u.isActive !== false
      }))
    });
  } catch (error) {
    console.error('Employees GET error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch employees',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
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
    const { firstName, lastName, email, password, team } = body;

    if (!email || !password || !firstName || !team) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        required: ['firstName', 'email', 'password', 'team']
      }, { status: 400 });
    }

    const existing = await db.collection('users').findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') } 
    });
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const roleMap: Record<string, string> = {
      'Calling': 'calling', 
      'Executive': 'executive', 
      'Backend': 'backend',
      'Accounts': 'accounting', 
      'Marketing': 'marketing',
      'Accounting': 'accounting'
    };
    const teamRole = roleMap[team] || team.toLowerCase();

    const result = await db.collection('users').insertOne({
      firstName,
      lastName: lastName || '',
      email: email.toLowerCase(),
      password: hashedPassword,
      roles: ['employee', teamRole],
      team,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return NextResponse.json({ 
      success: true,
      message: 'Employee created successfully', 
      id: result.insertedId.toString(),
      employee: {
        id: result.insertedId.toString(),
        firstName,
        lastName: lastName || '',
        email: email.toLowerCase(),
        team,
        roles: ['employee', teamRole],
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Employee POST error:', error);
    return NextResponse.json({ 
      error: 'Failed to create employee',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
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
    
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Valid Employee ID required' }, { status: 400 });
    }

    // Soft delete: mark as inactive
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          isActive: false, 
          updatedAt: new Date(),
          deletedAt: new Date()
        } 
      }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Employee deactivated successfully' 
    });
  } catch (error) {
    console.error('Employee DELETE error:', error);
    return NextResponse.json({ 
      error: 'Failed to delete employee',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}