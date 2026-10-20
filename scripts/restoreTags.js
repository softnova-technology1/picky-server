const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('../src/models/product.model');

async function restore() {
  await mongoose.connect(process.env.MONGODB_URI);
  await Product.updateOne({ name: 'new loolk' }, { $set: { tags: ['best sellers'] } });
  await Product.updateOne({ name: 'CAKE' }, { $set: { tags: ['Gopika Deals'] } });
  await Product.updateOne({ name: 'BVXGHFGMN N' }, { $set: { tags: ['limited deals'] } });
  await Product.updateOne({ name: 'GFSDGFD' }, { $set: { tags: ['Gopika Sri'] } });

  const products = await Product.find({}).lean();
  console.log('Restored products:');
  products.forEach(p => console.log(p.name, '=> tags:', p.tags, '=> offerLabel:', p.offerLabel, '=> isDiscountActive:', p.isDiscountActive));
  process.exit(0);
}

restore().catch(err => {
  console.error(err);
  process.exit(1);
});
