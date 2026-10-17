const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const subUploadDir = path.join(__dirname, '../uploads/subcategories');
if (!fs.existsSync(subUploadDir)) {
  fs.mkdirSync(subUploadDir, { recursive: true });
}

async function migrate() {
  const uri = 'mongodb+srv://pickysn2026_db_user:pickysoftnova%402026@cluster0.eob1f2i.mongodb.net/picky?retryWrites=true&w=majority';
  await mongoose.connect(uri);
  const SubCategory = mongoose.model('SubCategory', new mongoose.Schema({}, { strict: false }));
  const subs = await SubCategory.find({});
  let converted = 0;
  for (const s of subs) {
    if (s.image && typeof s.image === 'string' && s.image.startsWith('data:image')) {
      const matches = s.image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const ext = matches[1].includes('webp') ? 'webp' : 'jpg';
        const buffer = Buffer.from(matches[2], 'base64');
        const filename = `${s.slug || s._id}-${Date.now().toString(36)}.${ext}`;
        const filePath = path.join(subUploadDir, filename);
        fs.writeFileSync(filePath, buffer);
        const publicUrl = `http://localhost:5000/uploads/subcategories/${filename}`;
        await SubCategory.updateOne({ _id: s._id }, { $set: { image: publicUrl } });
        converted++;
        console.log('Converted subcategory:', s.name, '->', filename);
      }
    }
  }
  console.log('Done! Converted', converted, 'subcategories.');
  await mongoose.disconnect();
}
migrate().catch(console.error);
