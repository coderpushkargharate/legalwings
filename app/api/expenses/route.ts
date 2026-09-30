import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ObjectId } from 'mongodb';

// ============================================================================
// 🔹 /api/expenses — manually entered expenses (money going OUT), stored in their
// own `expenses` collection so they stay separate from lead-derived GRN/DHC data
// and from the `bills` payment ledger (money coming IN). Backs the "Add Expense"
// form in the Payment Statement → Expenses tab.
// ============================================================================

// Payment modes an expense can be paid by. Kept in sync with the billing UI.
const PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'CHEQUE', 'BANK_TRANSFER'];

// Expense categories. Kept in sync with the frontend dropdown.
const EXPENSE_CATEGORIES = ['OFFICE', 'TRAVEL', 'SALARY', 'RENT', 'UTILITIES', 'GOVT', 'COMMISSION', 'OTHER'];

// GET /api/expenses — list expenses (newest first) with optional filters + summary.
export async function GET(request: Request) {
  const token = getTokenFromHeaders(request);
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const searchText = searchParams.get('searchText');
    const category = searchParams.get('category');
    const paymentMode = searchParams.get('paymentMode');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const filter: Record<string, unknown> = {};
    if (category) filter.category = category;
    if (paymentMode) filter.paymentMode = paymentMode;
    if (searchText) {
      filter.$or = [
        { title: { $regex: searchText, $options: 'i' } },
        { paidTo: { $regex: searchText, $options: 'i' } },
        { note: { $regex: searchText, $options: 'i' } },
      ];
    }
    // Filter on the expense date (spentAt). Boundaries use the local day range.
    if (fromDate || toDate) {
      const range: Record<string, Date> = {};
      if (fromDate) range.$gte = new Date(`${fromDate}T00:00:00.000`);
      if (toDate) range.$lte = new Date(`${toDate}T23:59:59.999`);
      filter.spentAt = range;
    }

    const total = await db.collection('expenses').countDocuments(filter);
    const expenses = await db.collection('expenses')
      .find(filter)
      .sort({ spentAt: -1, createdAt: -1 })
      .skip(page * pageSize)
      .limit(pageSize)
      .toArray();

    // Summary across ALL matching expenses (not just this page) for the stat cards.
    const summaryAgg = await db.collection('expenses').aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]).toArray();

    const summary = {
      totalAmount: summaryAgg.reduce((s, m) => s + (m.total || 0), 0),
      totalCount: summaryAgg.reduce((s, m) => s + (m.count || 0), 0),
      byCategory: EXPENSE_CATEGORIES.map((cat) => {
        const found = summaryAgg.find((m) => m._id === cat);
        return { category: cat, total: found?.total || 0, count: found?.count || 0 };
      }),
    };

    return NextResponse.json({
      expensePage: {
        content: expenses.map((e) => ({ id: e._id.toString(), ...e, _id: undefined })),
        totalElements: total,
        totalPages: Math.ceil(total / pageSize) || 1,
        number: page,
      },
      summary,
    });
  } catch (error) {
    console.error('Expenses GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

// POST /api/expenses — record a new expense.
export async function POST(request: Request) {
  const token = getTokenFromHeaders(request);
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    const body = await request.json();

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Please enter an expense title' }, { status: 400 });
    }
    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Enter a valid amount greater than 0' }, { status: 400 });
    }
    const category = body.category ? String(body.category).toUpperCase() : 'OTHER';
    if (!EXPENSE_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid expense category' }, { status: 400 });
    }
    const paymentMode = (body.paymentMode || 'CASH').toUpperCase();
    if (!PAYMENT_MODES.includes(paymentMode)) {
      return NextResponse.json({ error: 'Invalid payment mode' }, { status: 400 });
    }

    // spentAt = when the expense actually happened (defaults to now if not given).
    const spentAt = body.spentAt ? new Date(body.spentAt) : new Date();
    if (isNaN(spentAt.getTime())) {
      return NextResponse.json({ error: 'Invalid expense date' }, { status: 400 });
    }

    const expense = {
      // Human-friendly voucher number, e.g. EXP-20260930-4821.
      voucherNo: `EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      title: body.title.trim(),
      category,
      amount,
      paidTo: body.paidTo?.trim() || '',
      paymentMode,
      transactionRef: body.transactionRef?.trim() || '',
      note: body.note?.trim() || '',
      spentAt,
      createdByUserId: payload.userId,
      createdByUserName: `${payload.firstName || ''} ${payload.lastName || ''}`.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('expenses').insertOne(expense);
    return NextResponse.json({ id: result.insertedId.toString(), ...expense, _id: undefined }, { status: 201 });
  } catch (error: any) {
    console.error('Expense POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create expense' }, { status: 500 });
  }
}

// DELETE /api/expenses?id=... — remove an expense record.
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
      return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 });
    }

    let objectId: ObjectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid expense ID' }, { status: 400 });
    }

    const result = await db.collection('expenses').deleteOne({ _id: objectId });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Expense deleted successfully' });
  } catch (error: any) {
    console.error('Expense DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete expense' }, { status: 500 });
  }
}
