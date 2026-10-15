const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Category = require('../src/models/category.model');
const SubCategory = require('../src/models/subcategory.model');
const Product = require('../src/models/product.model');

const DEFINITIVE_CATEGORIES = [
  {
    name: "Women's Fashion",
    slug: 'womens-fashion',
    description: 'Sarees, Kurtis, Leggings, Nightwear, Dupattas',
    image: '',
    sortOrder: 1,
    isActive: true,
    subcategories: [
      { name: 'Sarees', slug: 'sarees' },
      { name: 'Kurtis', slug: 'kurtis' },
      { name: 'Leggings', slug: 'leggings' },
      { name: 'Nightwear', slug: 'nightwear' },
      { name: 'Dupattas', slug: 'dupattas' },
    ],
  },
  {
    name: 'Home & Kitchen',
    slug: 'home-kitchen',
    description: 'Storage boxes, Choppers, Organizers, Cookware',
    image: '',
    sortOrder: 2,
    isActive: true,
    subcategories: [
      { name: 'Storage boxes', slug: 'storage-boxes' },
      { name: 'Choppers', slug: 'choppers' },
      { name: 'Organizers', slug: 'organizers' },
      { name: 'Cookware', slug: 'cookware' },
    ],
  },
  {
    name: 'Artificial Jewellery',
    slug: 'artificial-jewellery',
    description: 'Earrings, Chains, Bangles, Necklace sets',
    image: '',
    sortOrder: 3,
    isActive: true,
    subcategories: [
      { name: 'Earrings', slug: 'earrings' },
      { name: 'Chains', slug: 'chains' },
      { name: 'Bangles', slug: 'bangles' },
      { name: 'Necklace sets', slug: 'necklace-sets' },
    ],
  },
  {
    name: 'Beauty & Personal Care',
    slug: 'beauty-personal-care',
    description: 'Hair accessories, skincare, herbal products',
    image: '',
    sortOrder: 4,
    isActive: true,
    subcategories: [
      { name: 'Hair accessories', slug: 'hair-accessories' },
      { name: 'Skincare', slug: 'skincare' },
      { name: 'Herbal products', slug: 'herbal-products' },
    ],
  },
  {
    name: 'Mobile Accessories',
    slug: 'mobile-accessories',
    description: 'Cases, Chargers, Cables, Stands, Earbuds',
    image: '',
    sortOrder: 5,
    isActive: true,
    subcategories: [
      { name: 'Cases', slug: 'cases' },
      { name: 'Chargers', slug: 'chargers' },
      { name: 'Cables', slug: 'cables' },
      { name: 'Stands', slug: 'stands' },
      { name: 'Earbuds', slug: 'earbuds' },
    ],
  },
  {
    name: 'Traditional Tamil Products',
    slug: 'traditional-tamil-products',
    description: 'Sungudi sarees, brass items, Tanjore crafts',
    image: '',
    sortOrder: 6,
    isActive: true,
    subcategories: [
      { name: 'Sungudi sarees', slug: 'sungudi-sarees' },
      { name: 'Brass items', slug: 'brass-items' },
      { name: 'Tanjore crafts', slug: 'tanjore-crafts' },
    ],
  },
  {
    name: 'Snacks & Foods',
    slug: 'snacks-foods',
    description: 'Murukku, mixture, pickles, podi, sweets',
    image: '',
    sortOrder: 7,
    isActive: true,
    subcategories: [
      { name: 'Murukku', slug: 'murukku' },
      { name: 'Mixture', slug: 'mixture' },
      { name: 'Pickles', slug: 'pickles' },
      { name: 'Podi', slug: 'podi' },
      { name: 'Sweets', slug: 'sweets' },
    ],
  },
  {
    name: 'Home Décor',
    slug: 'home-decor',
    description: 'Wall décor, artificial plants, lamps, organizers',
    image: '',
    sortOrder: 8,
    isActive: true,
    subcategories: [
      { name: 'Wall décor', slug: 'wall-decor' },
      { name: 'Artificial plants', slug: 'artificial-plants' },
      { name: 'Lamps', slug: 'lamps' },
      { name: 'Organizers', slug: 'home-decor-organizers' },
    ],
  },
  {
    name: 'Kids Products',
    slug: 'kids-products',
    description: 'Toys, stationery, school accessories',
    image: '',
    sortOrder: 9,
    isActive: true,
    subcategories: [
      { name: 'Toys', slug: 'toys' },
      { name: 'Stationery', slug: 'stationery' },
      { name: 'School accessories', slug: 'school-accessories' },
    ],
  },
  {
    name: 'Fitness Products',
    slug: 'fitness-products',
    description: 'Resistance bands, yoga accessories, bottles',
    image: '',
    sortOrder: 10,
    isActive: true,
    subcategories: [
      { name: 'Resistance bands', slug: 'resistance-bands' },
      { name: 'Yoga accessories', slug: 'yoga-accessories' },
      { name: 'Bottles', slug: 'bottles' },
    ],
  },
];

async function runSeed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
  console.log('Connected to MongoDB Atlas.');

  // 1. Drop existing subcategories index if it has global slug_1 unique
  try {
    const subIndexes = await mongoose.connection.collection('subcategories').indexes();
    const hasSlugUnique = subIndexes.some(idx => idx.name === 'slug_1');
    if (hasSlugUnique) {
      await mongoose.connection.collection('subcategories').dropIndex('slug_1');
      console.log('Dropped legacy slug_1 unique index on subcategories');
    }
  } catch (err) {
    console.warn('Index check note:', err.message);
  }

  // 2. Clear existing subcategories collection completely
  const delSubResult = await SubCategory.deleteMany({});
  console.log(`Cleared ${delSubResult.deletedCount} existing subcategories from DB.`);

  // 3. Clear existing categories collection completely
  const delCatResult = await Category.deleteMany({});
  console.log(`Cleared ${delCatResult.deletedCount} existing categories from DB.`);

  // 4. Insert 10 new categories and their subcategories
  const createdCategoryMap = {};

  for (const cat of DEFINITIVE_CATEGORIES) {
    const createdCat = await Category.create({
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      image: '',
      sortOrder: cat.sortOrder,
      isActive: true,
    });

    createdCategoryMap[cat.slug] = createdCat._id;
    console.log(`Created Category: [${cat.sortOrder}] ${cat.name} (${cat.slug}) -> ID: ${createdCat._id}`);

    // Create subcategories for this category
    for (let i = 0; i < cat.subcategories.length; i++) {
      const sub = cat.subcategories[i];
      await SubCategory.create({
        name: sub.name,
        slug: sub.slug,
        categoryId: createdCat._id,
        description: `${sub.name} in ${cat.name}`,
        image: '',
        status: 'active',
        displayOrder: i + 1,
      });
      console.log(`   └─ Subcategory [${i + 1}]: ${sub.name} (${sub.slug})`);
    }
  }

  // 5. Ensure existing products reference the newly created categories
  const products = await Product.find({});
  if (products.length > 0) {
    console.log(`Updating ${products.length} existing products to point to new category IDs...`);
    for (const prod of products) {
      let targetCatId = createdCategoryMap['womens-fashion'];
      let targetSub = 'Sarees';

      const pName = (prod.name || '').toLowerCase();
      if (pName.includes('time') || pName.includes('5ttrg')) {
        targetCatId = createdCategoryMap['home-kitchen'];
        targetSub = 'Organizers';
      } else if (pName.includes('balm') || pName.includes('relief')) {
        targetCatId = createdCategoryMap['beauty-personal-care'];
        targetSub = 'Herbal products';
      } else if (pName.includes('kurt') || pName.includes('krishh')) {
        targetCatId = createdCategoryMap['womens-fashion'];
        targetSub = 'Kurtis';
      } else if (pName.includes('saree')) {
        targetCatId = createdCategoryMap['womens-fashion'];
        targetSub = 'Sarees';
      }

      await Product.updateOne({ _id: prod._id }, { $set: { category: targetCatId, subCategory: targetSub } });
    }
    console.log('Updated existing products to valid categories.');
  }

  const finalCatCount = await Category.countDocuments();
  const finalSubCount = await SubCategory.countDocuments();
  console.log(`\n🎉 Verification Completed:`);
  console.log(`- Categories in DB: ${finalCatCount}`);
  console.log(`- Sub-Categories in DB: ${finalSubCount}`);

  await mongoose.disconnect();
  console.log('MongoDB connection closed.');
}

runSeed().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
