import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

export async function POST(request: Request) {
  const token = getTokenFromHeaders(request);
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();

    const [cities, areas, leadStatuses, agreementStatuses, backOfficeStatuses, executives] = await Promise.all([
      db.collection('cities').find({}).sort({ name: 1 }).toArray(),
      db.collection('areas').find({}).sort({ name: 1 }).toArray(),
      db.collection('leadStatuses').find({}).toArray(),
      db.collection('agreementStatuses').find({}).toArray(),
      db.collection('backOfficeStatuses').find({}).toArray(),
      db.collection('executives').find({}).toArray(),
    ]);

    return NextResponse.json({
      cities: cities.map(c => ({ id: c._id.toString(), name: c.name, state: c.state })),
      areas: areas.map(a => ({ id: a._id.toString(), name: a.name, cityId: a.cityId?.toString(), cityName: a.cityName })),
      leadStatuses,
      agreementStatuses,
      backOfficeStatuses,
      executives: executives.map(e => ({ id: e._id.toString(), name: e.name, userId: e.userId })),
    });
  } catch (error) {
    console.error('Dropdowns error:', error);
    return NextResponse.json({ error: 'Failed to fetch dropdowns' }, { status: 500 });
  }
}
