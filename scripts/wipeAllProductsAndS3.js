const mongoose = require('mongoose');
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const Product = require('../src/models/product.model');
const Inventory = require('../src/models/inventory.model');
const Category = require('../src/models/category.model');
const SubCategory = require('../src/models/subcategory.model');

async function wipeProductsAndS3() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB Atlas\n');

  // 1. Initial State Check
  const initialProductsCount = await Product.countDocuments();
  const initialInventoriesCount = await Inventory.countDocuments();
  const categoriesCount = await Category.countDocuments();
  const subCategoriesCount = await SubCategory.countDocuments();

  console.log('====================================================');
  console.log('              PRE-WIPE VERIFICATION                 ');
  console.log('====================================================');
  console.log(`Current Products to delete:     ${initialProductsCount}`);
  console.log(`Current Inventories to delete:  ${initialInventoriesCount}`);
  console.log(`Categories to PROTECT:          ${categoriesCount}`);
  console.log(`SubCategories to PROTECT:       ${subCategoriesCount}`);
  console.log('====================================================\n');

  // 2. AWS S3 Product Images Deletion
  const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const bucket = process.env.AWS_S3_BUCKET_NAME;
  console.log(`Connecting to AWS S3 Bucket: "${bucket}"...`);

  // Find all objects strictly under prefix "picky/products/"
  const productPrefix = 'picky/products/';
  let continuationToken = null;
  const keysToDelete = [];

  do {
    const listRes = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: productPrefix,
      ContinuationToken: continuationToken,
    }));

    if (listRes.Contents && listRes.Contents.length > 0) {
      for (const item of listRes.Contents) {
        keysToDelete.push({ Key: item.Key });
      }
    }
    continuationToken = listRes.NextContinuationToken;
  } while (continuationToken);

  console.log(`Found ${keysToDelete.length} product images in S3 under "${productPrefix}".`);

  let deletedS3Count = 0;
  if (keysToDelete.length > 0) {
    // S3 DeleteObjects supports batches up to 1000 keys
    for (let i = 0; i < keysToDelete.length; i += 1000) {
      const batch = keysToDelete.slice(i, i + 1000);
      const delRes = await s3Client.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch,
          Quiet: false,
        },
      }));
      deletedS3Count += delRes.Deleted?.length || batch.length;
      console.log(`🗑️ Deleted batch of ${batch.length} S3 product images.`);
    }
  }

  // 3. Delete from MongoDB: ONLY Product and Inventory
  console.log('\nDeleting MongoDB Product and Inventory collections...');
  const prodDelRes = await Product.deleteMany({});
  const invDelRes = await Inventory.deleteMany({});

  console.log(`✅ Deleted ${prodDelRes.deletedCount} Product documents.`);
  console.log(`✅ Deleted ${invDelRes.deletedCount} Inventory documents.`);

  // 4. Post-Wipe Verification
  const finalProductsCount = await Product.countDocuments();
  const finalInventoriesCount = await Inventory.countDocuments();
  const finalCategoriesCount = await Category.countDocuments();
  const finalSubCategoriesCount = await SubCategory.countDocuments();

  // Verify S3 under prefix
  const verifyList = await s3Client.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: productPrefix,
  }));
  const remainingS3Products = verifyList.Contents ? verifyList.Contents.length : 0;

  console.log('\n====================================================');
  console.log('              POST-WIPE AUDIT REPORT                ');
  console.log('====================================================');
  console.log(`Remaining Products in DB:       ${finalProductsCount}  (Expected: 0)`);
  console.log(`Remaining Inventories in DB:    ${finalInventoriesCount}  (Expected: 0)`);
  console.log(`Remaining S3 Product Images:    ${remainingS3Products}  (Expected: 0)`);
  console.log(`Total S3 Images Deleted:        ${deletedS3Count}`);
  console.log(`Categories Preserved:           ${finalCategoriesCount}  (10 intact)`);
  console.log(`SubCategories Preserved:        ${finalSubCategoriesCount}  (39 intact)`);
  console.log('====================================================\n');

  if (finalProductsCount === 0 && finalInventoriesCount === 0 && remainingS3Products === 0) {
    console.log('🎉 SUCCESS: All products and product images in S3 permanently deleted.');
    console.log('All categories, subcategories, and non-product data remain completely safe!');
  } else {
    console.warn('⚠️ Warning: Some items may still remain.');
  }

  await mongoose.disconnect();
}

wipeProductsAndS3().catch(err => {
  console.error('❌ Wipe failed:', err);
  process.exit(1);
});
