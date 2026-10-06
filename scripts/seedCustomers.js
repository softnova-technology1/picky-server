require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/user.model');

const SAMPLE_CUSTOMERS = [
  {
    name: 'Priya Ramesh',
    email: 'priya.ramesh@gmail.com',
    phone: '+91 98401 23456',
    role: 'customer',
    orderCount: 6,
    defaultAddress: {
      street: '42, 4th Cross Street, Anna Nagar',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600040',
    },
    addresses: [
      {
        street: '42, 4th Cross Street, Anna Nagar',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600040',
        isDefault: true,
      },
    ],
  },
  {
    name: 'Ananya Krishnan',
    email: 'ananya.k@gmail.com',
    phone: '+91 98402 34567',
    role: 'customer',
    orderCount: 4,
    defaultAddress: {
      street: '15, Indiranagar 100 Feet Rd',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560038',
    },
    addresses: [
      {
        street: '15, Indiranagar 100 Feet Rd',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560038',
        isDefault: true,
      },
    ],
  },
  {
    name: 'Deepa Sundaram',
    email: 'deepa.sundaram@yahoo.com',
    phone: '+91 98403 45678',
    role: 'customer',
    orderCount: 2,
    defaultAddress: {
      street: '88, Race Course Road',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      pincode: '641018',
    },
    addresses: [
      {
        street: '88, Race Course Road',
        city: 'Coimbatore',
        state: 'Tamil Nadu',
        pincode: '641018',
        isDefault: true,
      },
    ],
  },
  {
    name: 'Karthik Subramanian',
    email: 'karthik.sub@gmail.com',
    phone: '+91 98404 56789',
    role: 'customer',
    orderCount: 1,
    defaultAddress: {
      street: '102, Banjara Hills Rd 12',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500034',
    },
    addresses: [
      {
        street: '102, Banjara Hills Rd 12',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500034',
        isDefault: true,
      },
    ],
  },
];

async function seedCustomers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
    });
    console.log('✅ Connected to MongoDB Atlas');

    for (const cust of SAMPLE_CUSTOMERS) {
      const existing = await User.findOne({ email: cust.email });
      if (!existing) {
        await User.create(cust);
        console.log(`👤 Customer created: ${cust.name} (${cust.email})`);
      } else {
        console.log(`👤 Customer already exists: ${cust.email}`);
      }
    }

    const totalCust = await User.countDocuments({ role: 'customer' });
    console.log(`🎉 Total Customers in Atlas: ${totalCust}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding customers:', err);
    process.exit(1);
  }
}

seedCustomers();
