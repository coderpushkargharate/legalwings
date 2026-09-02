import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    // Case-insensitive email lookup — accounts are stored lowercased, so match
    // regardless of how the user typed their email (avoids "wrong password" errors
    // caused purely by letter case).
    const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const user = await db.collection('users').findOne({
      email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Block deactivated/deleted employees from logging in
    if (user.isActive === false) {
      return NextResponse.json({ error: 'Account has been deactivated' }, { status: 403 });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles || ['admin'],
      team: user.team,
    });

    return NextResponse.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles || ['admin'],
        team: user.team,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
