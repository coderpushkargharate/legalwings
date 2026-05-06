import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const { db } = await connectToDatabase();

    // Create default admin user
    const users = db.collection('users');
    const existingUser = await users.findOne({ email: 'pushkargharate3011@gmail.com' });

    if (!existingUser) {
      const hashedPassword = await bcrypt.hash('pushkar3011', 12);
      await users.insertOne({
        email: 'pushkargharate3011@gmail.com',
        password: hashedPassword,
        firstName: 'Pushkar',
        lastName: 'Gharate',
        roles: ['admin'],
        createdAt: new Date(),
      });
    }

    // Seed cities
    const cities = db.collection('cities');
    const cityCount = await cities.countDocuments();
    if (cityCount === 0) {
      await cities.insertMany([
        { name: 'Mumbai', state: 'Maharashtra', createdAt: new Date() },
        { name: 'Pune', state: 'Maharashtra', createdAt: new Date() },
        { name: 'Delhi', state: 'Delhi', createdAt: new Date() },
        { name: 'Bangalore', state: 'Karnataka', createdAt: new Date() },
        { name: 'Hyderabad', state: 'Telangana', createdAt: new Date() },
      ]);
    }

    // Seed areas
    const areas = db.collection('areas');
    const areaCount = await areas.countDocuments();
    if (areaCount === 0) {
      const cityList = await cities.find({}).toArray();
      const mumbai = cityList.find(c => c.name === 'Mumbai');
      const pune = cityList.find(c => c.name === 'Pune');

      await areas.insertMany([
        { name: 'Andheri', cityId: mumbai?._id, cityName: 'Mumbai', createdAt: new Date() },
        { name: 'Bandra', cityId: mumbai?._id, cityName: 'Mumbai', createdAt: new Date() },
        { name: 'Dadar', cityId: mumbai?._id, cityName: 'Mumbai', createdAt: new Date() },
        { name: 'Borivali', cityId: mumbai?._id, cityName: 'Mumbai', createdAt: new Date() },
        { name: 'Kothrud', cityId: pune?._id, cityName: 'Pune', createdAt: new Date() },
        { name: 'Hinjewadi', cityId: pune?._id, cityName: 'Pune', createdAt: new Date() },
        { name: 'Shivajinagar', cityId: pune?._id, cityName: 'Pune', createdAt: new Date() },
        { name: 'Baner', cityId: pune?._id, cityName: 'Pune', createdAt: new Date() },
      ]);
    }

    // Seed lead statuses
    const leadStatuses = db.collection('leadStatuses');
    const statusCount = await leadStatuses.countDocuments();
    if (statusCount === 0) {
      await leadStatuses.insertMany([
        { key: 'NEW_LEAD', value: 'New Lead' },
        { key: 'INTERESTED', value: 'Interested' },
        { key: 'NOT_INTERESTED', value: 'Not Interested' },
        { key: 'CALL_NOT_RECEIVED', value: 'Call Not Received' },
        { key: 'FIRST_FOLLOWUP', value: '1st Follow-up' },
        { key: 'SECOND_FOLLOWUP', value: '2nd Follow Up' },
        { key: 'THIRD_FOLLOWUP', value: '3rd Follow Up' },
        { key: 'DOCUMENTS_RECEIVED', value: 'Documents Received' },
        { key: 'CREATE_DRAFT', value: 'Create Draft' },
        { key: 'DRAFT_CONFIRM_PENDING', value: 'Draft Confirm Pending' },
        { key: 'DRAFT_CONFIRM', value: 'Draft Confirm' },
        { key: 'BOOKING_APPOINTMENT', value: 'Booking Appointment' },
        { key: 'ASSIGNED_APPOINTMENT', value: 'Assigned Appointment' },
        { key: 'CANCEL_APPOINTMENT', value: 'Cancel Appointment' },
        { key: 'POSTPONE_APPOINTMENT', value: 'Postpone Appointment' },
        { key: 'LOST', value: 'Lost' },
      ]);
    }

    // Seed agreement statuses
    const agreementStatuses = db.collection('agreementStatuses');
    const agreeCount = await agreementStatuses.countDocuments();
    if (agreeCount === 0) {
      await agreementStatuses.insertMany([
        { key: 'PENDING', value: 'Pending' },
        { key: 'DRAFTED', value: 'Drafted' },
        { key: 'CONFIRMED', value: 'Confirmed' },
        { key: 'REGISTERED', value: 'Registered' },
        { key: 'COMPLETED', value: 'Completed' },
        { key: 'CANCELLED', value: 'Cancelled' },
      ]);
    }

    // Seed back office statuses
    const backOfficeStatuses = db.collection('backOfficeStatuses');
    const boCount = await backOfficeStatuses.countDocuments();
    if (boCount === 0) {
      await backOfficeStatuses.insertMany([
        { key: 'PENDING', value: 'Pending' },
        { key: 'IN_PROGRESS', value: 'In Progress' },
        { key: 'COMPLETED', value: 'Completed' },
        { key: 'REJECTED', value: 'Rejected' },
      ]);
    }

    // Seed executives
    const executives = db.collection('executives');
    const execCount = await executives.countDocuments();
    if (execCount === 0) {
      await executives.insertMany([
        { name: 'Rajesh Kumar', userId: 'exec_001', userType: 'EXECUTIVE', createdAt: new Date() },
        { name: 'Sunita Patil', userId: 'exec_002', userType: 'EXECUTIVE', createdAt: new Date() },
        { name: 'Vikram Singh', userId: 'exec_003', userType: 'EXECUTIVE', createdAt: new Date() },
      ]);
    }

    return NextResponse.json({ message: 'Database seeded successfully' });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Failed to seed database' }, { status: 500 });
  }
}
