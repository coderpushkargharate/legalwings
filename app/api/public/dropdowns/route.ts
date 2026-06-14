// app/api/public/dropdowns/route.ts
// External Developer API — Dropdown reference data
//   GET /api/public/dropdowns → cities, areas, lead/agreement/backOffice statuses
// Auth: x-api-key header. (GET so it is easy to consume from any front-end.)
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

    const [cities, areas, leadStatuses, agreementStatuses, backOfficeStatuses] = await Promise.all([
      db.collection('cities').find({}).sort({ name: 1 }).toArray(),
      db.collection('areas').find({}).sort({ name: 1 }).toArray(),
      db.collection('leadStatuses').find({}).toArray(),
      db.collection('agreementStatuses').find({}).toArray(),
      db.collection('backOfficeStatuses').find({}).toArray(),
    ]);

    const normalizedLeadStatuses = leadStatuses.some(s => s.key === 'COMPLETED')
      ? leadStatuses
      : [...leadStatuses, { key: 'COMPLETED', value: 'Completed', color: '#059669', order: 16 }];

    return jsonResponse(request, {
      success: true,
      cities: cities.map(c => ({ id: c._id.toString(), name: c.name, state: c.state })),
      areas: areas.map(a => ({ id: a._id.toString(), name: a.name, cityId: a.cityId?.toString(), cityName: a.cityName })),
      leadStatuses: normalizedLeadStatuses,
      agreementStatuses,
      backOfficeStatuses,
      // Static enums that developers commonly need for their own dropdowns.
      clientTypes: ['OWNER', 'TENANT', 'AGENT'],
      teams: ['CALLING_TEAM', 'EXECUTIVE_TEAM', 'BACKEND_TEAM', 'ACCOUNTING_TEAM', 'MARKETING_TEAM'],
    });
  } catch (error) {
    console.error('Public dropdowns GET error:', error);
    return jsonResponse(request, { error: 'Failed to fetch dropdowns' }, 500);
  }
}
