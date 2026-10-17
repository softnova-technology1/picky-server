const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('../src/models/product.model');
const Inventory = require('../src/models/inventory.model');
const Category = require('../src/models/category.model');
const SubCategory = require('../src/models/subcategory.model');

async function analyze() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(uri);
  console.log('Connected to MongoDB Atlas\n');

  const totalProducts = await Product.countDocuments();
  const totalInventories = await Inventory.countDocuments();
  const totalCategories = await Category.countDocuments();
  const totalSubCategories = await SubCategory.countDocuments();

  console.log('=============================================');
  console.log('             DATABASE OVERVIEW               ');
  console.log('=============================================');
  console.log(`Total Products:       ${totalProducts}`);
  console.log(`Total Inventories:    ${totalInventories}`);
  console.log(`Total Categories:     ${totalCategories}`);
  console.log(`Total SubCategories:  ${totalSubCategories}`);
  console.log('=============================================\n');

  // Group by category and subcategory
  const breakdown = await Product.aggregate([
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'catInfo'
      }
    },
    {
      $unwind: { path: '$catInfo', preserveNullAndEmptyArrays: true }
    },
    {
      $group: {
        _id: {
          categoryName: '$catInfo.name',
          subCategory: '$subCategory'
        },
        count: { $sum: 1 },
        sampleProduct: { $first: '$name' },
        samplePrice: { $first: '$price' },
        sampleStock: { $first: '$stock' },
        sampleImage: { $first: { $arrayElemAt: ['$images', 0] } }
      }
    },
    { $sort: { '_id.categoryName': 1, '_id.subCategory': 1 } }
  ]);

  console.log('--- PRODUCTS BREAKDOWN BY CATEGORY & SUBCATEGORY ---');
  let s3Count = 0;
  let nonS3Count = 0;

  breakdown.forEach((b, idx) => {
    const isS3 = b.sampleImage && b.sampleImage.includes('s3');
    if (isS3) s3Count += b.count;
    else nonS3Count += b.count;
    console.log(`${idx + 1}. [${b._id.categoryName || 'Unknown'}] ${b._id.subCategory}: ${b.count} products (e.g., "${b.sampleProduct}", ₹${b.samplePrice}, Stock: ${b.sampleStock})`);
  });

  // Check all images in DB for S3 vs others
  const allProducts = await Product.find({}).select('images').lean();
  let totalWithS3Images = 0;
  let totalWithOtherImages = 0;
  allProducts.forEach(p => {
    const img = p.images?.[0] || '';
    if (img.includes('amazonaws.com') || img.includes('s3.')) {
      totalWithS3Images++;
    } else {
      totalWithOtherImages++;
    }
  });

  console.log('\n=============================================');
  console.log('               IMAGE AUDIT                   ');
  console.log('=============================================');
  console.log(`Products with AWS S3 Images:     ${totalWithS3Images}`);
  console.log(`Products with Other/Direct URLs: ${totalWithOtherImages}`);
  console.log('=============================================\n');

  // Check subcategories missing products
  const allSubCats = await SubCategory.find({}).populate('categoryId').lean();
  const subCatsWithProducts = new Set(breakdown.map(b => b._id.subCategory));
  const missingSubCats = allSubCats.filter(s => !subCatsWithProducts.has(s.name));

  if (missingSubCats.length > 0) {
    console.log(`⚠️ Missing / Incomplete SubCategories (${missingSubCats.length}):`);
    missingSubCats.forEach(s => {
      console.log(`  - [${s.categoryId?.name}] ${s.name} (0 products)`);
    });
  } else {
    console.log('All 39 SubCategories have products!');
  }

  // Sample S3 URL
  const sample = await Product.findOne({ 'images.0': { $regex: 'amazonaws.com' } }).select('name images').lean();
  if (sample) {
    console.log('\nSample S3 Product URL:');
    console.log(`Product: ${sample.name}`);
    console.log(`S3 URL:  ${sample.images?.[0]}`);
  }

  await mongoose.disconnect();
}

analyze().catch(err => {
  console.error(err);
  process.exit(1);
});
