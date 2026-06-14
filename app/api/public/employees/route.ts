// app/api/public/employees/route.ts
// External Developer API — Employees dropdown / search
//   GET /api/public/employees                 → active employees (dropdown)
//   GET /api/public/employees?team=Calling     → filter by team
//   GET /api/public/employees?searchText=amit   → search by name / email
// Auth: x-api-key header.
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
    const { searchParams } = new URL(request.url);
    const teamFilter = searchParams.get('team');
    const searchText = searchParams.get('searchText');

    const filter: Record<string, any> = {
      roles: { $in: ['employee', 'calling', 'executive', 'backend', 'accounting', 'marketing'] },
      isActive: { $ne: false },
    };

    if (teamFilter && teamFilter.trim() !== '') {
      const roleMap: Record<string, string> = {
        Calling: 'calling', Executive: 'executive', Backend: 'backend',
        Accounts: 'accounting', Marketing: 'marketing', Accounting: 'accounting',
      };
      const teamRole = roleMap[teamFilter] || teamFilter.toLowerCase();
      filter.$or = [
        { team: { $regex: new RegExp(`^${teamFilter}$`, 'i') } },
        { roles: { $in: [teamRole] } },
      ];
    }

    if (searchText && searchText.trim() !== '') {
      filter.$and = [{
        $or: [
          { firstName: { $regex: searchText, $options: 'i' } },
          { lastName: { $regex: searchText, $options: 'i' } },
          { email: { $regex: searchText, $options: 'i' } },
        ],
      }];
    }

    const users = await db.collection('users')
      .find(filter)
      .sort({ firstName: 1, lastName: 1 })
      .toArray();

    return jsonResponse(request, {
      success: true,
      employees: users.map(u => ({
        id: u._id?.toString() || u.id,
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
        email: u.email || '',
        team: u.team || 'Unknown',
        roles: u.roles || [],
      })),
    });
  } catch (error) {
    console.error('Public employees GET error:', error);
    return jsonResponse(request, { error: 'Failed to fetch employees' }, 500);
  }
}
