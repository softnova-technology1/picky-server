require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user.model');
const Category = require('../models/category.model');
const Product = require('../models/product.model');
const Inventory = require('../models/inventory.model');
const Coupon = require('../models/coupon.model');
const Discount = require('../models/discount.model');
const Cart = require('../models/cart.model');
const Wishlist = require('../models/wishlist.model');
const Order = require('../models/order.model');

async function seed() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/picky';
    console.log('Connecting to MongoDB Atlas Cluster...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB Atlas');

    // 1. Clean all collections to prevent dummy data clash
    console.log('🧹 Cleaning mock products, categories, and test data...');
    await Promise.all([
      Category.deleteMany({}),
      Product.deleteMany({}),
      Inventory.deleteMany({}),
      Coupon.deleteMany({}),
      Discount.deleteMany({}),
      Cart.deleteMany({}),
      Wishlist.deleteMany({}),
      Order.deleteMany({}),
      User.deleteMany({}),
    ]);
    console.log('✅ All dummy/mock data purged from database');

    // 2. Initialize Single Root Administrator
    console.log('🔐 Initializing Root Administrator account...');
    const admin = await User.create({
      name: 'Admin Softnova',
      email: 'admin@picky.com',
      password: 'Admin@Picky2026!',
      phone: '+919876543210',
      role: 'admin',
      isActive: true,
      defaultAddress: {
        street: 'Softnova HQ, 1st Cross Road',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600001',
        landmark: 'Near Tech Park',
      },
      addresses: [
        {
          street: 'Softnova HQ, 1st Cross Road',
          city: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600001',
          landmark: 'Near Tech Park',
          isDefault: true,
        },
      ],
    });

    console.log('\n======================================================');
    console.log('🎉 PICKY STORE INITIALIZED WITH CLEAN DATABASE!');
    console.log('======================================================');
    console.log('🔐 Admin Portal URL: http://localhost:3000/pickyadmin-softnova2026');
    console.log('📧 Admin Email     : admin@picky.com');
    console.log('🔑 Admin Password  : Admin@Picky2026!');
    console.log('🏪 Products Status : 0 products (Ready for live Admin uploads)');
    console.log('📂 Categories      : 0 categories (Ready for live Admin uploads)');
    console.log('======================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Database initialization error:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  seed();
}

module.exports = seed;
