const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/user.model');

async function createAdmin() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not defined in .env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000,
    });
    console.log('✅ Connected to MongoDB Atlas successfully.');

    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@picky.com').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'softnova-2026';
    const adminName = process.env.ADMIN_NAME || 'Store Administrator';
    const adminPhone = process.env.ADMIN_PHONE || '+919876543210';

    let admin = await User.findOne({ email: adminEmail });

    if (admin) {
      console.log(`⚠️ User with email "${adminEmail}" already exists. Updating credentials...`);
      admin.name = adminName;
      admin.role = 'admin';
      admin.password = adminPassword; // Triggers pre('save') bcrypt hashing
      admin.isActive = true;
      admin.phone = adminPhone;
      await admin.save();
      console.log('✅ Existing user upgraded to Administrator and credentials updated.');
    } else {
      console.log(`Creating new Administrator account: ${adminEmail}...`);
      admin = new User({
        name: adminName,
        email: adminEmail,
        phone: adminPhone,
        password: adminPassword, // Triggers pre('save') bcrypt hashing
        role: 'admin',
        isActive: true,
      });
      await admin.save();
      console.log('✅ New Administrator account created successfully.');
    }

    // Immediate sanity check: test password comparison
    const isMatch = await admin.comparePassword(adminPassword);
    if (isMatch) {
      console.log('🔒 Password verification check: PASSED (bcrypt hash matches).');
    } else {
      console.error('❌ Password verification check: FAILED.');
    }

    console.log('\n=============================================');
    console.log('👑 Admin Credentials:');
    console.log(`   Email:    ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Role:     ${admin.role}`);
    console.log(`   User ID:  ${admin._id}`);
    console.log('=============================================\n');
  } catch (error) {
    console.error('❌ Failed to create admin user:', error.message);
    if (error.message.includes('ETIMEDOUT') || error.message.includes('Whitelisted') || error.message.includes('bad auth')) {
      console.error('💡 Tip: Make sure your IP address is whitelisted in MongoDB Atlas Network Access (0.0.0.0/0).');
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

createAdmin();
