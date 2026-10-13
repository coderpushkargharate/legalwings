import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

// ============================================================================
// 🔹 /api/public/template/[slug] — no login needed; backs the shareable /p/<slug> page.
//   GET  → the published template
//   POST → a visitor's "Write a Review" ({ name, rating, text })
// ============================================================================

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('business_templates').findOne(
      { slug, status: 'PUBLISHED' },
      { projection: { createdByUserId: 0, createdByUserName: 0 } },
    );
    if (!doc) return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    const { _id, ...rest } = doc;
    return NextResponse.json({ template: { id: _id.toString(), ...rest } });
  } catch (error) {
    console.error('Public template GET error:', error);
    return NextResponse.json({ error: 'Failed to load page' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 60) : '';
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 600) : '';
  const rating = Math.min(5, Math.max(1, Math.round(Number(body?.rating) || 0)));
  if (!name || !text || !Number(body?.rating)) {
    return NextResponse.json({ error: 'Please enter your name, rating and review' }, { status: 400 });
  }

  try {
    const { db } = await connectToDatabase();
    const review = { name, rating, text, date: new Date().toISOString().slice(0, 10), photo: '' };
    // Newest review first; keep the list bounded.
    const result = await db.collection('business_templates').findOneAndUpdate(
      { slug, status: 'PUBLISHED' },
      { $push: { reviews: { $each: [review], $position: 0, $slice: 50 } } as any },
      { returnDocument: 'after', projection: { reviews: 1 } },
    );
    if (!result) return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    return NextResponse.json({ reviews: result.reviews || [] }, { status: 201 });
  } catch (error) {
    console.error('Public template review error:', error);
    return NextResponse.json({ error: 'Failed to save review' }, { status: 500 });
  }
}
