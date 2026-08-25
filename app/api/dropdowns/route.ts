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

    // Safety net: guarantee the "Completed" lead status is always available in
    // dropdowns even if the database was seeded before it was introduced.
    const normalizedLeadStatuses = leadStatuses.some(s => s.key === 'COMPLETED')
      ? leadStatuses
      : [...leadStatuses, { key: 'COMPLETED', value: 'Completed', color: '#059669', order: 16 }];

    // Safety net: guarantee the "Cancelled" agreement status is always available in
    // dropdowns even if the database was seeded before it was introduced.
    const withCancelled = agreementStatuses.some(s => s.key === 'CANCELLED')
      ? agreementStatuses
      : [...agreementStatuses, { key: 'CANCELLED', value: 'Cancelled', color: '#EF4444', order: 6 }];

    // Extra agreement statuses used by the lead forms. `key === value` so a filter
    // by these matches the exact string the forms save into `agreement.status`.
    const EXTRA_AGREEMENT_STATUSES = [
      { key: 'Payment + Witness Pending', value: 'Payment + Witness Pending', color: '#F59E0B', order: 7 },
      { key: 'All Pending', value: 'All Pending', color: '#F59E0B', order: 8 },
      { key: 'All VP Pending', value: 'All VP Pending', color: '#F59E0B', order: 9 },
      { key: 'Draft Ready', value: 'Draft Ready', color: '#3B82F6', order: 10 },
    ];
    const normalizedAgreementStatuses = [
      ...withCancelled,
      ...EXTRA_AGREEMENT_STATUSES.filter(e => !withCancelled.some(s => s.key === e.key)),
    ];

    return NextResponse.json({
      cities: cities.map(c => ({ id: c._id.toString(), name: c.name, state: c.state })),
      areas: areas.map(a => ({ id: a._id.toString(), name: a.name, cityId: a.cityId?.toString(), cityName: a.cityName })),
      leadStatuses: normalizedLeadStatuses,
      agreementStatuses: normalizedAgreementStatuses,
      backOfficeStatuses,
      executives: executives.map(e => ({ id: e._id.toString(), name: e.name, userId: e.userId })),
    });
  } catch (error) {
    console.error('Dropdowns error:', error);
    return NextResponse.json({ error: 'Failed to fetch dropdowns' }, { status: 500 });
  }
}
