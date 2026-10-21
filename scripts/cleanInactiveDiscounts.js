const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  const isDryRun = process.argv.includes('--dry-run');

  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI not found in environment.');
    process.exit(1);
  }

  console.log(`[CLEANUP] Connecting to MongoDB (Dry-run mode: ${isDryRun ? 'YES' : 'NO'})...`);
  await mongoose.connect(process.env.MONGODB_URI);

  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));

  const filter = { isDiscountActive: false };
  const targetCount = await Product.countDocuments(filter);
  console.log(`[CLEANUP] Found ${targetCount} products with isDiscountActive: false`);

  if (isDryRun) {
    console.log('[CLEANUP] Dry run completed. No documents modified.');
  } else {
    const res = await Product.updateMany(
      filter,
      { $unset: { discountPrice: 1, offerLabel: 1, offerStartDate: 1, offerEndDate: 1 } }
    );
    console.log('[CLEANUP] Unset inactive discount fields result:', res);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('[CLEANUP ERROR]:', err);
  process.exit(1);
});
