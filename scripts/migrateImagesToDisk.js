const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, '../uploads/products');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

async function migrate() {
  console.log('🚀 Starting Base64 to Static Disk Image Migration...');
  const t0 = Date.now();
  const uri = 'mongodb+srv://pickysn2026_db_user:pickysoftnova%402026@cluster0.eob1f2i.mongodb.net/picky?retryWrites=true&w=majority';
  await mongoose.connect(uri);

  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
  const products = await Product.find({});

  let convertedCount = 0;

  for (const prod of products) {
    let modified = false;
    const newImages = [];

    if (Array.isArray(prod.images)) {
      for (let i = 0; i < prod.images.length; i++) {
        const img = prod.images[i];
        if (img && typeof img === 'string' && img.startsWith('data:image')) {
          // Extract base64 payload
          const matches = img.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const ext = matches[1].includes('webp') ? 'webp' : (matches[1].includes('png') ? 'png' : 'jpg');
            const buffer = Buffer.from(matches[2], 'base64');
            const filename = `${prod.slug || prod._id}-${i}-${Date.now().toString(36)}.${ext}`;
            const filePath = path.join(uploadDir, filename);

            fs.writeFileSync(filePath, buffer);
            const publicUrl = `http://localhost:5000/uploads/products/${filename}`;
            newImages.push(publicUrl);
            modified = true;
            convertedCount++;
            console.log(`  ✓ Converted image ${i + 1} for "${prod.name}" -> ${filename} (${buffer.length} bytes)`);
          } else {
            newImages.push(img);
          }
        } else {
          newImages.push(img);
        }
      }
    }

    if (modified) {
      await Product.updateOne({ _id: prod._id }, { $set: { images: newImages } });
      console.log(`✅ Updated "${prod.name}" in DB with static URLs`);
    }
  }

  // Also check Category images
  const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false }));
  const catUploadDir = path.join(__dirname, '../uploads/categories');
  if (!fs.existsSync(catUploadDir)) {
    fs.mkdirSync(catUploadDir, { recursive: true });
  }

  const categories = await Category.find({});
  for (const cat of categories) {
    if (cat.image && typeof cat.image === 'string' && cat.image.startsWith('data:image')) {
      const matches = cat.image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const ext = matches[1].includes('webp') ? 'webp' : 'jpg';
        const buffer = Buffer.from(matches[2], 'base64');
        const filename = `${cat.slug || cat._id}-${Date.now().toString(36)}.${ext}`;
        const filePath = path.join(catUploadDir, filename);
        fs.writeFileSync(filePath, buffer);
        const publicUrl = `http://localhost:5000/uploads/categories/${filename}`;
        await Category.updateOne({ _id: cat._id }, { $set: { image: publicUrl } });
        convertedCount++;
        console.log(`✅ Updated category "${cat.name}" with static URL: ${filename}`);
      }
    }
  }

  await mongoose.disconnect();
  console.log(`🎉 Migration finished! Converted ${convertedCount} images in ${Date.now() - t0} ms.`);
}

migrate().catch(console.error);
