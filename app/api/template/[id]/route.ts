import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import { isAdmin, sanitizeTemplate, toClient } from '../sanitize';

// 🔹 /api/template/[id] — admin-only read / update / delete of one template.

function authorize(request: Request) {
  const token = getTokenFromHeaders(request);
  const user = token ? verifyToken(token) : null;
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdmin(user)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = authorize(request);
  if (error) return error;
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid template id' }, { status: 400 });

  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('business_templates').findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    return NextResponse.json({ template: toClient(doc) });
  } catch (err) {
    console.error('Template GET by id error:', err);
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = authorize(request);
  if (error) return error;
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid template id' }, { status: 400 });

  try {
    const { db } = await connectToDatabase();
    const data = sanitizeTemplate(await request.json());
    if (!data.businessName) {
      return NextResponse.json({ error: 'Please enter the business name' }, { status: 400 });
    }
    if (!data.slug) {
      return NextResponse.json({ error: 'Please enter a valid page link' }, { status: 400 });
    }
    const clash = await db.collection('business_templates').findOne(
      { slug: data.slug, _id: { $ne: new ObjectId(id) } },
      { projection: { _id: 1 } },
    );
    if (clash) {
      return NextResponse.json({ error: `The page link "${data.slug}" is already used by another template` }, { status: 409 });
    }

    const result = await db.collection('business_templates').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!result) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    return NextResponse.json({ template: toClient(result) });
  } catch (err) {
    console.error('Template PUT error:', err);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = authorize(request);
  if (error) return error;
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid template id' }, { status: 400 });

  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('business_templates').deleteOne({ _id: new ObjectId(id) });
    if (!result.deletedCount) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Template DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
