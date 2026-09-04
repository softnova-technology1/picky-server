require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user.model');
const Category = require('../models/category.model');
const Product = require('../models/product.model');
const Inventory = require('../models/inventory.model');
const Coupon = require('../models/coupon.model');
const Discount = require('../models/discount.model');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/picky');
    console.log('Connected to DB for seeding...');

    // 1. Seed Admin (with encrypted password) & Customer User
    await User.deleteMany({});
    const admin = await User.create({
      name: 'Admin Softnova',
      email: 'admin@picky.com',
      password: 'Admin@Picky2026!',
      phone: '+919876543210',
      role: 'admin',
      addresses: [{ line1: 'Softnova HQ, 1st Cross', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001', isDefault: true }],
    });

    const customer = await User.create({
      phone: '+919998887770',
      name: 'Picky Customer',
      role: 'customer',
      addresses: [{ line1: '42 Gandhi Road', city: 'Chennai', state: 'Tamil Nadu', pincode: '600028', isDefault: true }],
    });

    console.log('✅ Users seeded: Admin & Customer');

    // 2. Seed Categories
    await Category.deleteMany({});
    const categories = await Category.insertMany([
      { name: 'Electronics', slug: 'electronics', description: 'Gadgets, audio, and accessories', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500', isFeatured: true },
      { name: 'Fashion & Apparel', slug: 'fashion', description: 'Trendy clothes and accessories', image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=500', isFeatured: true },
      { name: 'Home & Living', slug: 'home-living', description: 'Premium home decor and essentials', image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=500', isFeatured: true },
      { name: 'Beauty & Wellness', slug: 'beauty-wellness', description: 'Skincare and organic cosmetics', image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500', isFeatured: true },
    ]);

    console.log('✅ Categories seeded');

    // 3. Seed Products & Inventory
    await Product.deleteMany({});
    await Inventory.deleteMany({});

    const productsData = [
      {
        name: 'AeroSound Pro Wireless Headphones',
        slug: 'aerosound-pro-wireless-headphones',
        category: categories[0]._id,
        price: 3999,
        discountPrice: 2499,
        description: 'Active Noise Cancellation, 40-hour battery life, ultra-comfortable memory foam ear cushions with deep bass sound.',
        images: [
          'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
          'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800'
        ],
        tags: ['headphones', 'wireless', 'bluetooth', 'audio', 'anc'],
        isFeatured: true,
        stock: 50,
      },
      {
        name: 'NovaFit Smart Watch Ultra',
        slug: 'novafit-smart-watch-ultra',
        category: categories[0]._id,
        price: 5499,
        discountPrice: 3299,
        description: '1.96-inch AMOLED display, Bluetooth calling, 120+ sports modes, 24/7 heart rate and SpO2 tracking with 7-day battery.',
        images: [
          'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800',
          'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800'
        ],
        tags: ['smartwatch', 'fitness', 'bluetooth', 'wearable'],
        isFeatured: true,
        stock: 35,
      },
      {
        name: 'Minimalist Linen Everyday Shirt',
        slug: 'minimalist-linen-everyday-shirt',
        category: categories[1]._id,
        price: 1899,
        discountPrice: 1299,
        description: '100% breathable organic linen shirt tailored for casual elegance and all-day comfort in tropical weather.',
        images: [
          'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800',
          'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800'
        ],
        tags: ['shirt', 'linen', 'menswear', 'casual', 'organic'],
        isFeatured: true,
        stock: 40,
      },
      {
        name: 'Artisan Ceramic Pour-Over Set',
        slug: 'artisan-ceramic-pour-over-set',
        category: categories[2]._id,
        price: 2499,
        discountPrice: 1799,
        description: 'Handcrafted matte ceramic coffee dripper and carafe set. Designed for the ultimate slow-drip coffee brewing ritual.',
        images: [
          'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800'
        ],
        tags: ['coffee', 'ceramic', 'kitchen', 'home', 'artisan'],
        isFeatured: false,
        stock: 25,
      },
      {
        name: 'Botanical Glow Facial Elixir',
        slug: 'botanical-glow-facial-elixir',
        category: categories[3]._id,
        price: 1599,
        discountPrice: 999,
        description: 'Cold-pressed rosehip seed oil enriched with Vitamin C and botanical squalane for radiant, nourished morning skin.',
        images: [
          'https://images.unsplash.com/photo-1608248597359-5431665a3bd9?w=800'
        ],
        tags: ['skincare', 'serum', 'organic', 'beauty', 'glow'],
        isFeatured: true,
        stock: 60,
      },
    ];

    for (const p of productsData) {
      const { stock, ...productDoc } = p;
      const createdProd = await Product.create(productDoc);
      await Inventory.create({ product: createdProd._id, quantity: stock });
    }

    console.log('✅ Products & Inventory seeded');

    // 4. Seed Coupons
    await Coupon.deleteMany({});
    await Coupon.insertMany([
      { code: 'WELCOME10', type: 'percentage', value: 10, minOrderAmount: 999, maxDiscountAmount: 300, isActive: true },
      { code: 'PICKY500', type: 'flat', value: 500, minOrderAmount: 2999, isActive: true },
      { code: 'FESTIVE20', type: 'percentage', value: 20, minOrderAmount: 1499, maxDiscountAmount: 500, isActive: true },
    ]);

    console.log('✅ Coupons seeded');

    // 5. Seed Discounts
    await Discount.deleteMany({});
    await Discount.insertMany([
      { name: 'First Order Special Discount', type: 'flat', value: 150, minOrderAmount: 500, appliesTo: 'first_order', isActive: true },
      { name: 'Weekend Flash Sale', type: 'percentage', value: 15, minOrderAmount: 1000, maxDiscountAmount: 400, appliesTo: 'all', isActive: true },
    ]);

    console.log('✅ Discounts seeded');

    console.log('🎉 Database seeding complete!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  seed();
}

module.exports = seed;
