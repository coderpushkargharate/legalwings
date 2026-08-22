import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ObjectId } from 'mongodb';

// Payment modes the billing UI supports. Kept in sync with the frontend dropdown.
const PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'CHEQUE', 'BANK_TRANSFER'];

// GET /api/bills — list bills (newest first) with optional filters + a summary.
export async function GET(request: Request) {
  const token = getTokenFromHeaders(request);
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const searchText = searchParams.get('searchText');
    const paymentMode = searchParams.get('paymentMode');
    const clientId = searchParams.get('clientId');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const filter: Record<string, unknown> = {};
    if (paymentMode) filter.paymentMode = paymentMode;
    if (clientId) filter.clientId = clientId;
    if (searchText) {
      filter.$or = [
        { clientName: { $regex: searchText, $options: 'i' } },
        { clientPhone: { $regex: searchText, $options: 'i' } },
        { billNo: { $regex: searchText, $options: 'i' } },
        { transactionRef: { $regex: searchText, $options: 'i' } },
      ];
    }
    // Filter on the payment time (paidAt). Boundaries use the local day range.
    if (fromDate || toDate) {
      const range: Record<string, Date> = {};
      if (fromDate) range.$gte = new Date(`${fromDate}T00:00:00.000`);
      if (toDate) range.$lte = new Date(`${toDate}T23:59:59.999`);
      filter.paidAt = range;
    }

    const total = await db.collection('bills').countDocuments(filter);
    const bills = await db.collection('bills')
      .find(filter)
      .sort({ paidAt: -1, createdAt: -1 })
      .skip(page * pageSize)
      .limit(pageSize)
      .toArray();

    // Summary across ALL matching bills (not just this page) for the stat cards.
    const summaryAgg = await db.collection('bills').aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$paymentMode',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]).toArray();

    const summary = {
      totalAmount: summaryAgg.reduce((s, m) => s + (m.total || 0), 0),
      totalCount: summaryAgg.reduce((s, m) => s + (m.count || 0), 0),
      byMode: PAYMENT_MODES.map((mode) => {
        const found = summaryAgg.find((m) => m._id === mode);
        return { mode, total: found?.total || 0, count: found?.count || 0 };
      }),
    };

    return NextResponse.json({
      billPage: {
        content: bills.map((b) => ({ id: b._id.toString(), ...b, _id: undefined })),
        totalElements: total,
        totalPages: Math.ceil(total / pageSize) || 1,
        number: page,
      },
      summary,
    });
  } catch (error) {
    console.error('Bills GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 });
  }
}

// POST /api/bills — record a new payment/bill for a user.
export async function POST(request: Request) {
  const token = getTokenFromHeaders(request);
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    const body = await request.json();

    const amount = parseFloat(body.amount);
    if (!body.clientName?.trim()) {
      return NextResponse.json({ error: 'Please select or enter a user name' }, { status: 400 });
    }
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Enter a valid amount greater than 0' }, { status: 400 });
    }
    const paymentMode = (body.paymentMode || 'CASH').toUpperCase();
    if (!PAYMENT_MODES.includes(paymentMode)) {
      return NextResponse.json({ error: 'Invalid payment mode' }, { status: 400 });
    }

    // paidAt = when the payment actually happened (defaults to now if not given).
    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
    if (isNaN(paidAt.getTime())) {
      return NextResponse.json({ error: 'Invalid payment date/time' }, { status: 400 });
    }

    const bill = {
      // Human-friendly bill number, e.g. INV-20260821-4821.
      billNo: `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      clientId: body.clientId || null,
      clientName: body.clientName.trim(),
      clientPhone: body.clientPhone?.trim() || '',
      amount,
      paymentMode,
      transactionRef: body.transactionRef?.trim() || '',
      note: body.note?.trim() || '',
      paidAt,
      createdByUserId: payload.userId,
      createdByUserName: `${payload.firstName || ''} ${payload.lastName || ''}`.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('bills').insertOne(bill);
    return NextResponse.json({ id: result.insertedId.toString(), ...bill, _id: undefined }, { status: 201 });
  } catch (error: any) {
    console.error('Bill POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create bill' }, { status: 500 });
  }
}

// DELETE /api/bills?id=... — remove a bill record.
export async function DELETE(request: Request) {
  const token = getTokenFromHeaders(request);
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Bill ID is required' }, { status: 400 });
    }

    let objectId: ObjectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid bill ID' }, { status: 400 });
    }

    const result = await db.collection('bills').deleteOne({ _id: objectId });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Bill deleted successfully' });
  } catch (error: any) {
    console.error('Bill DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete bill' }, { status: 500 });
  }
}
