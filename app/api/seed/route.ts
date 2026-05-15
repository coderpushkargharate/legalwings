import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const { db } = await connectToDatabase();

    // ========================================
    // 👥 USERS COLLECTION
    // ========================================
    const users = db.collection('users');

    // ✅ Add NEW user: Akshay Gonate
    const newEmail = 'akshaygonate123@gmail.com';
    const newPassword = 'Akshay$00100cr';
    const existingNewUser = await users.findOne({ email: newEmail });
    
    if (!existingNewUser) {
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await users.insertOne({
        email: newEmail,
        password: hashedPassword,
        firstName: 'Akshay',
        lastName: 'Gonate',
        roles: ['admin'],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('✅ New user created:', newEmail);
    }

    // ✅ Keep default admin: Pushkar Gharate
    const adminEmail = 'pushkargharate3011@gmail.com';
    const existingAdmin = await users.findOne({ email: adminEmail });
    
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('pushkar3011', 12);
      await users.insertOne({
        email: adminEmail,
        password: hashedPassword,
        firstName: 'Pushkar',
        lastName: 'Gharate',
        roles: ['admin'],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('✅ Admin user created:', adminEmail);
    }

    // ========================================
    // 🏙️ CITIES COLLECTION
    // ========================================
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
      console.log('✅ Cities seeded');
    }

    // ========================================
    // 📍 AREAS COLLECTION
    // ========================================
    const areas = db.collection('areas');
    const areaCount = await areas.countDocuments();
    
    if (areaCount === 0) {
      const cityList = await cities.find({}).toArray();
      const mumbai = cityList.find((c: any) => c.name === 'Mumbai');
      const pune = cityList.find((c: any) => c.name === 'Pune');
      const delhi = cityList.find((c: any) => c.name === 'Delhi');
      const bangalore = cityList.find((c: any) => c.name === 'Bangalore');
      const hyderabad = cityList.find((c: any) => c.name === 'Hyderabad');

      await areas.insertMany([
        // Mumbai Areas
        { name: 'Andheri', cityId: mumbai?._id, cityName: 'Mumbai', createdAt: new Date() },
        { name: 'Bandra', cityId: mumbai?._id, cityName: 'Mumbai', createdAt: new Date() },
        { name: 'Dadar', cityId: mumbai?._id, cityName: 'Mumbai', createdAt: new Date() },
        { name: 'Borivali', cityId: mumbai?._id, cityName: 'Mumbai', createdAt: new Date() },
        { name: 'Juhu', cityId: mumbai?._id, cityName: 'Mumbai', createdAt: new Date() },
        { name: 'Powai', cityId: mumbai?._id, cityName: 'Mumbai', createdAt: new Date() },
        
        // Pune Areas
        { name: 'Kothrud', cityId: pune?._id, cityName: 'Pune', createdAt: new Date() },
        { name: 'Hinjewadi', cityId: pune?._id, cityName: 'Pune', createdAt: new Date() },
        { name: 'Shivajinagar', cityId: pune?._id, cityName: 'Pune', createdAt: new Date() },
        { name: 'Baner', cityId: pune?._id, cityName: 'Pune', createdAt: new Date() },
        { name: 'Wakad', cityId: pune?._id, cityName: 'Pune', createdAt: new Date() },
        { name: 'Viman Nagar', cityId: pune?._id, cityName: 'Pune', createdAt: new Date() },
        
        // Delhi Areas
        { name: 'Connaught Place', cityId: delhi?._id, cityName: 'Delhi', createdAt: new Date() },
        { name: 'Dwarka', cityId: delhi?._id, cityName: 'Delhi', createdAt: new Date() },
        { name: 'Rohini', cityId: delhi?._id, cityName: 'Delhi', createdAt: new Date() },
        
        // Bangalore Areas
        { name: 'Koramangala', cityId: bangalore?._id, cityName: 'Bangalore', createdAt: new Date() },
        { name: 'Indiranagar', cityId: bangalore?._id, cityName: 'Bangalore', createdAt: new Date() },
        { name: 'Whitefield', cityId: bangalore?._id, cityName: 'Bangalore', createdAt: new Date() },
        
        // Hyderabad Areas
        { name: 'Gachibowli', cityId: hyderabad?._id, cityName: 'Hyderabad', createdAt: new Date() },
        { name: 'Madhapur', cityId: hyderabad?._id, cityName: 'Hyderabad', createdAt: new Date() },
        { name: 'Secunderabad', cityId: hyderabad?._id, cityName: 'Hyderabad', createdAt: new Date() },
      ]);
      console.log('✅ Areas seeded');
    }

    // ========================================
    // 📊 LEAD STATUSES COLLECTION
    // ========================================
    const leadStatuses = db.collection('leadStatuses');
    const statusCount = await leadStatuses.countDocuments();
    
    if (statusCount === 0) {
      await leadStatuses.insertMany([
        { key: 'NEW_LEAD', value: 'New Lead', color: '#3B82F6', order: 1 },
        { key: 'INTERESTED', value: 'Interested', color: '#10B981', order: 2 },
        { key: 'NOT_INTERESTED', value: 'Not Interested', color: '#6B7280', order: 3 },
        { key: 'CALL_NOT_RECEIVED', value: 'Call Not Received', color: '#F59E0B', order: 4 },
        { key: 'FIRST_FOLLOWUP', value: '1st Follow-up', color: '#8B5CF6', order: 5 },
        { key: 'SECOND_FOLLOWUP', value: '2nd Follow Up', color: '#8B5CF6', order: 6 },
        { key: 'THIRD_FOLLOWUP', value: '3rd Follow Up', color: '#8B5CF6', order: 7 },
        { key: 'DOCUMENTS_RECEIVED', value: 'Documents Received', color: '#06B6D4', order: 8 },
        { key: 'CREATE_DRAFT', value: 'Create Draft', color: '#EC4899', order: 9 },
        { key: 'DRAFT_CONFIRM_PENDING', value: 'Draft Confirm Pending', color: '#F97316', order: 10 },
        { key: 'DRAFT_CONFIRM', value: 'Draft Confirm', color: '#10B981', order: 11 },
        { key: 'BOOKING_APPOINTMENT', value: 'Booking Appointment', color: '#6366F1', order: 12 },
        { key: 'ASSIGNED_APPOINTMENT', value: 'Assigned Appointment', color: '#6366F1', order: 13 },
        { key: 'CANCEL_APPOINTMENT', value: 'Cancel Appointment', color: '#EF4444', order: 14 },
        { key: 'POSTPONE_APPOINTMENT', value: 'Postpone Appointment', color: '#F59E0B', order: 15 },
        { key: 'LOST', value: 'Lost', color: '#9CA3AF', order: 16 },
      ]);
      console.log('✅ Lead statuses seeded');
    }

    // ========================================
    // 📑 AGREEMENT STATUSES COLLECTION
    // ========================================
    const agreementStatuses = db.collection('agreementStatuses');
    const agreeCount = await agreementStatuses.countDocuments();
    
    if (agreeCount === 0) {
      await agreementStatuses.insertMany([
        { key: 'PENDING', value: 'Pending', color: '#F59E0B', order: 1 },
        { key: 'DRAFTED', value: 'Drafted', color: '#3B82F6', order: 2 },
        { key: 'CONFIRMED', value: 'Confirmed', color: '#10B981', order: 3 },
        { key: 'REGISTERED', value: 'Registered', color: '#8B5CF6', order: 4 },
        { key: 'COMPLETED', value: 'Completed', color: '#059669', order: 5 },
        { key: 'CANCELLED', value: 'Cancelled', color: '#EF4444', order: 6 },
      ]);
      console.log('✅ Agreement statuses seeded');
    }

    // ========================================
    // ⚙️ BACK OFFICE STATUSES COLLECTION
    // ========================================
    const backOfficeStatuses = db.collection('backOfficeStatuses');
    const boCount = await backOfficeStatuses.countDocuments();
    
    if (boCount === 0) {
      await backOfficeStatuses.insertMany([
        { key: 'PENDING', value: 'Pending', color: '#F59E0B', order: 1 },
        { key: 'IN_PROGRESS', value: 'In Progress', color: '#3B82F6', order: 2 },
        { key: 'COMPLETED', value: 'Completed', color: '#10B981', order: 3 },
        { key: 'REJECTED', value: 'Rejected', color: '#EF4444', order: 4 },
      ]);
      console.log('✅ Back office statuses seeded');
    }

    // ========================================
    // 👔 EXECUTIVES COLLECTION
    // ========================================
    const executives = db.collection('executives');
    const execCount = await executives.countDocuments();
    
    if (execCount === 0) {
      await executives.insertMany([
        { 
          name: 'Rajesh Kumar', 
          userId: 'exec_001', 
          userType: 'EXECUTIVE', 
          email: 'rajesh@legalwings.com',
          phone: '+91-9876543210',
          assignedCities: ['Mumbai', 'Pune'],
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { 
          name: 'Sunita Patil', 
          userId: 'exec_002', 
          userType: 'EXECUTIVE', 
          email: 'sunita@legalwings.com',
          phone: '+91-9876543211',
          assignedCities: ['Pune', 'Bangalore'],
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { 
          name: 'Vikram Singh', 
          userId: 'exec_003', 
          userType: 'EXECUTIVE', 
          email: 'vikram@legalwings.com',
          phone: '+91-9876543212',
          assignedCities: ['Delhi', 'Hyderabad'],
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      console.log('✅ Executives seeded');
    }

    // ========================================
    // 📋 RESPONSE
    // ========================================
    return NextResponse.json({ 
      message: '✅ Database seeded successfully',
      data: {
        users: ['akshaygonate123@gmail.com', 'pushkargharate3011@gmail.com'],
        cities: 5,
        areas: 20,
        leadStatuses: 16,
        agreementStatuses: 6,
        backOfficeStatuses: 4,
        executives: 3,
      }
    });

  } catch (error) {
    console.error('❌ Seed error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to seed database', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    );
  }
}