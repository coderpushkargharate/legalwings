import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import { paymentAmountError } from '@/lib/validation';

export async function POST(request: Request) {
  const token = getTokenFromHeaders(request);
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    const body = await request.json();
    const amountErr = paymentAmountError(body);
    if (amountErr) return NextResponse.json({ error: amountErr }, { status: 400 });

    const payment = {
      ...body,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('payments').insertOne(payment);

    // Update the lead with payment reference
    if (body.leadId) {
      // The Expenses tab's Verify flag lives on lead.payment but isn't part of the
      // payment form — carry it over so re-saving the form doesn't reset it.
      const existing = await db.collection('leads').findOne(
        { _id: new ObjectId(body.leadId) },
        { projection: { 'payment.expenseVerified': 1 } },
      );
      if (body.expenseVerified === undefined && existing?.payment?.expenseVerified !== undefined) {
        payment.expenseVerified = existing.payment.expenseVerified;
      }

      // Mirror the owner/tenant payment lines onto the top-level `paymentDetails`
      // field too. Every UI that renders individual payments (View modal, the
      // add/edit lead form, the Accounting table) reads `lead.paymentDetails`,
      // not `lead.payment.paymentDetails` — so without this the received
      // payments save but never show up.
      const leadUpdate: Record<string, unknown> = {
        payment: { ...payment, id: result.insertedId.toString() },
        updatedAt: new Date(),
      };
      if (Array.isArray(body.paymentDetails)) {
        leadUpdate.paymentDetails = body.paymentDetails;
      }
      await db.collection('leads').updateOne(
        { _id: new ObjectId(body.leadId) },
        { $set: leadUpdate }
      );
    }

    return NextResponse.json({ ...payment, id: result.insertedId.toString() }, { status: 201 });
  } catch (error) {
    console.error('Payment POST error:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const token = getTokenFromHeaders(request);
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    const amountErr = paymentAmountError(updateData);
    if (amountErr) return NextResponse.json({ error: amountErr }, { status: 400 });

    updateData.updatedAt = new Date();
    await db.collection('payments').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    return NextResponse.json({ message: 'Payment updated successfully' });
  } catch (error) {
    console.error('Payment PUT error:', error);
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
  }
}
