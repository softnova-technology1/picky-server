const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Category = require('../src/models/category.model');

const CATEGORIES_DATA = [
  {
    name: "Women's Fashion",
    slug: 'womens-fashion',
    description: 'Sarees, Kurtis, Leggings, Nightwear, Dupattas, Dresses, Tops',
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80',
    sortOrder: 1,
    isActive: true,
    characteristics: [
      { name: 'Fabric Material', type: 'select', values: ['Pure Cotton', 'Soft Silk', 'Rayon', 'Georgette', 'Chanderi', 'Linen'], required: true },
      { name: 'Occasion', type: 'select', values: ['Festive', 'Daily Wear', 'Wedding / Bridal', 'Office Wear', 'Party'], required: true },
      { name: 'Pattern / Design', type: 'select', values: ['Traditional Zari', 'Handloom', 'Floral Print', 'Embroidered', 'Solid / Plain'], required: false },
      { name: 'Fit Type', type: 'select', values: ['Regular', 'Oversized', 'Slim Fit', 'Anarkali Flare'], required: false },
    ],
  },
  {
    name: 'Home & Kitchen',
    slug: 'home-kitchen',
    description: 'Storage boxes, Choppers, Organizers, Cookware',
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=80',
    sortOrder: 2,
    isActive: true,
    characteristics: [
      { name: 'Material', type: 'select', values: ['Pure Cast Iron', 'BPA-Free Plastic', 'Stainless Steel 304', 'Ceramic', 'Copper'], required: true },
      { name: 'Capacity', type: 'text', values: [], required: false },
      { name: 'Dishwasher Safe', type: 'select', values: ['Yes', 'No', 'Hand Wash Only'], required: false },
    ],
  },
  {
    name: 'Artificial Jewellery',
    slug: 'jewellery',
    description: 'Traditional Gold-plated & Silver Oxidized Jewellery',
    image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&auto=format&fit=crop&q=80',
    sortOrder: 3,
    isActive: true,
    characteristics: [
      { name: 'Base Material', type: 'select', values: ['Brass', 'Copper Alloy', 'German Silver', 'Zinc'], required: true },
      { name: 'Plating', type: 'select', values: ['18K Micro Gold', 'Antique Matte Gold', 'Silver Oxidized', 'Rhodium'], required: true },
      { name: 'Stone Type', type: 'select', values: ['Kundan', 'CZ American Diamond', 'Kemp Stones', 'Pearls', 'None'], required: false },
    ],
  },
  {
    name: 'Beauty & Personal Care',
    slug: 'beauty',
    description: 'Ayurvedic & Herbal Skincare, Haircare Essentials',
    image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&auto=format&fit=crop&q=80',
    sortOrder: 4,
    isActive: true,
    characteristics: [
      { name: 'Product Type', type: 'select', values: ['Ayurvedic Herbal', 'Organic Natural', 'Dermatologically Tested'], required: true },
      { name: 'Skin Type', type: 'select', values: ['All Skin Types', 'Oily / Acne Prone', 'Dry Skin', 'Sensitive'], required: false },
      { name: 'Volume / Weight', type: 'text', values: [], required: false },
    ],
  },
  {
    name: 'Mobile Accessories',
    slug: 'mobile-accessories',
    description: 'Fast Chargers, TWS Earbuds, Powerbanks, Stands',
    image: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&auto=format&fit=crop&q=80',
    sortOrder: 5,
    isActive: true,
    characteristics: [
      { name: 'Connectivity', type: 'select', values: ['Bluetooth 5.3', 'Type-C Fast Charge', 'Lightning', 'Wireless'], required: true },
      { name: 'Warranty', type: 'select', values: ['6 Months Replacement', '1 Year Manufacturer', 'No Warranty'], required: false },
      { name: 'Color', type: 'select', values: ['Matte Black', 'Arctic White', 'Navy Blue', 'Silver'], required: false },
    ],
  },
  {
    name: 'Traditional Snacks & Sweets',
    slug: 'sweets-snacks',
    description: 'Authentic South Indian Sweets, Mixtures, Home-made Savouries',
    image: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=600&auto=format&fit=crop&q=80',
    sortOrder: 6,
    isActive: true,
    characteristics: [
      { name: 'Dietary Type', type: 'select', values: ['100% Vegetarian', 'Pure Ghee', 'Jaggery Sweetened'], required: true },
      { name: 'Weight Options', type: 'select', values: ['250g', '500g', '1 Kg Pack'], required: true },
      { name: 'Shelf Life', type: 'text', values: [], required: false },
    ],
  },
  {
    name: 'Men\'s Fashion',
    slug: 'mens-fashion',
    description: 'Pure Cotton Shirts, Casual T-Shirts, Trackpants, Ethnic Dhotis',
    image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80',
    sortOrder: 7,
    isActive: true,
    characteristics: [
      { name: 'Fabric', type: 'select', values: ['100% Combed Cotton', 'Linen Cotton', 'Polycotton', 'Dry-Fit'], required: true },
      { name: 'Fit Type', type: 'select', values: ['Slim Fit', 'Regular Fit', 'Relaxed Oversized'], required: false },
      { name: 'Sleeve Length', type: 'select', values: ['Full Sleeve', 'Half Sleeve', 'Sleeveless'], required: false },
    ],
  },
  {
    name: 'Footwear',
    slug: 'footwear',
    description: 'Comfort Walk Sandals, Ethnic Juttis, Daily Slippers',
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&auto=format&fit=crop&q=80',
    sortOrder: 8,
    isActive: true,
    characteristics: [
      { name: 'Material', type: 'select', values: ['PU Leather', 'Breathable Mesh', 'EVA Soft Sole', 'Rubber'], required: true },
      { name: 'Sole Type', type: 'select', values: ['Anti-Slip Rubber', 'Cushioned Memory Foam', 'Flat'], required: false },
    ],
  },
  {
    name: 'Toys & Kids',
    slug: 'toys-kids',
    description: 'Montessori Educational Toys, Soft Plushies, Baby Essentials',
    image: 'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=600&auto=format&fit=crop&q=80',
    sortOrder: 9,
    isActive: true,
    characteristics: [
      { name: 'Age Group', type: 'select', values: ['0-2 Years', '3-5 Years', '6-10 Years', 'All Ages'], required: true },
      { name: 'Safety Certification', type: 'select', values: ['Non-Toxic BPA Free', 'ISI Certified', 'Child Safe Rounded Edges'], required: false },
    ],
  },
  {
    name: 'Bags & Wallets',
    slug: 'bags-wallets',
    description: 'Waterproof Laptop Backpacks, Stylish Handbags, Leather Wallets',
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80',
    sortOrder: 10,
    isActive: true,
    characteristics: [
      { name: 'Compartments', type: 'select', values: ['1 Main Compartment', '2 Compartments + Laptop Sleeve', 'Multi-pocket Organizer'], required: false },
      { name: 'Water Resistance', type: 'select', values: ['Waterproof Fabric', 'Water Resistant', 'Standard'], required: false },
    ],
  },
];

async function seedCategories() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not defined in .env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas to seed categories...');
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
    console.log('✅ Connected to MongoDB Atlas.');

    for (const catData of CATEGORIES_DATA) {
      const existing = await Category.findOne({ slug: catData.slug });
      if (existing) {
        await Category.updateOne({ slug: catData.slug }, { $set: catData });
        console.log(`🔄 Updated category: ${catData.name} (${catData.slug})`);
      } else {
        await Category.create(catData);
        console.log(`✨ Created category: ${catData.name} (${catData.slug})`);
      }
    }

    const totalCount = await Category.countDocuments();
    console.log(`\n🎉 Total categories in database: ${totalCount}`);
  } catch (error) {
    console.error('❌ Error seeding categories:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

seedCategories();
