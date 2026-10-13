import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { isAdmin, sanitizeTemplate, toClient } from './sanitize';

// ============================================================================
// 🔹 /api/template — admin-only CRUD for business profile templates, stored in
// the `business_templates` collection.
//   GET  /api/template?searchText=  → list (newest first, without heavy images)
//   POST /api/template              → create
// ============================================================================

export async function GET(request: Request) {
  const token = getTokenFromHeaders(request);
  const user = token ? verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const searchText = searchParams.get('searchText')?.trim();

    const filter: Record<string, unknown> = {};
    if (searchText) {
      const rx = { $regex: searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      filter.$or = [{ businessName: rx }, { category: rx }, { location: rx }, { slug: rx }];
    }

    // The list only needs the card fields — skip the big image arrays.
    const templates = await db.collection('business_templates')
      .find(filter, {
        projection: {
          slug: 1, status: 1, businessName: 1, category: 1, location: 1, photo: 1,
          verified: 1, createdByUserName: 1, createdAt: 1, updatedAt: 1,
          servicesCount: { $size: { $ifNull: ['$services', []] } },
          reviewsCount: { $size: { $ifNull: ['$reviews', []] } },
        },
      })
      .sort({ updatedAt: -1 })
      .toArray();

    return NextResponse.json({ templates: templates.map(toClient) });
  } catch (error) {
    console.error('Template GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const token = getTokenFromHeaders(request);
  const user = token ? verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { db } = await connectToDatabase();
    const data = sanitizeTemplate(await request.json());

    if (!data.businessName) {
      return NextResponse.json({ error: 'Please enter the business name' }, { status: 400 });
    }
    if (!data.slug) {
      return NextResponse.json({ error: 'Please enter a valid page link' }, { status: 400 });
    }
    if (await db.collection('business_templates').findOne({ slug: data.slug }, { projection: { _id: 1 } })) {
      return NextResponse.json({ error: `The page link "${data.slug}" is already used by another template` }, { status: 409 });
    }

    const now = new Date();
    const doc = {
      ...data,
      createdByUserId: user.userId,
      createdByUserName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      createdAt: now,
      updatedAt: now,
    };
    const result = await db.collection('business_templates').insertOne(doc);
    return NextResponse.json({ template: toClient({ _id: result.insertedId, ...doc }) }, { status: 201 });
  } catch (error) {
    console.error('Template POST error:', error);
    return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
  }
}
