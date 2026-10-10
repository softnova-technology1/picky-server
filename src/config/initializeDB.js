const mongoose = require('mongoose');
const Category = require('../models/category.model');

const MOCK_CATEGORIES = [
  {
    name: "Women's Fashion",
    slug: 'womens-fashion',
    description: 'Ethnic wear, western wear, and accessories for women.',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400',
    isActive: true,
  },
  {
    name: "Men's Fashion",
    slug: 'mens-fashion',
    description: 'Shirts, t-shirts, jeans, and activewear for men.',
    image: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?w=400',
    isActive: true,
  },
  {
    name: "Kids & Toys",
    slug: 'kids-toys',
    description: 'Clothing, toys, and essentials for kids and babies.',
    image: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=400',
    isActive: true,
  },
  { 
    name: "Home & Kitchen",
    slug: 'home-kitchen',
    description: 'Home decor, furnishings, and kitchen appliances.',
    image: 'https://images.unsplash.com/photo-1556910103-1c02745a872f?w=400',
    isActive: true,
  }
];

const Coupon = require('../models/coupon.model');

const DEFAULT_COUPONS = [
  { code: 'WELCOME100', type: 'flat', value: 100, minOrderAmount: 999, maxDiscountAmount: 100, isActive: true },
  { code: 'PICKY10', type: 'percentage', value: 10, minOrderAmount: 499, maxDiscountAmount: 300, isActive: true },
  { code: 'FESTIVE20', type: 'percentage', value: 20, minOrderAmount: 1499, maxDiscountAmount: 500, isActive: true },
];

const initializeDB = async () => {
  try {
    const count = await Category.countDocuments();
    if (count === 0) {
      console.log('Seeding default categories...');
      await Category.insertMany(MOCK_CATEGORIES);
      console.log('Default categories seeded.');
    }

    const couponCount = await Coupon.countDocuments();
    if (couponCount === 0) {
      console.log('Seeding default coupons...');
      await Coupon.insertMany(DEFAULT_COUPONS);
      console.log('Default coupons seeded.');
    }
  } catch (err) {
    console.error('Failed to initialize DB:', err);
  }
};

module.exports = initializeDB;
