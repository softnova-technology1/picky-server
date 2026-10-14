const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

async function fix() {
  const uri = 'mongodb+srv://pickysn2026_db_user:pickysoftnova%402026@cluster0.eob1f2i.mongodb.net/picky?retryWrites=true&w=majority';
  await mongoose.connect(uri);
  const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));

  const orders = await Order.find({});
  let updatedCount = 0;

  for (const o of orders) {
    const subtotal = Number(o.subtotal || 0);
    const total = Number(o.total || 0);
    const discount = Number(o.discountAmount || 0);
    const currentShipping = Number(o.shippingFee || 0);
    const diff = total - (subtotal - discount);

    if (currentShipping === 0 && diff > 0) {
      let shippingFee = 40;
      let convenienceFee = 2;
      if (diff === 42) {
        shippingFee = 40;
        convenienceFee = 2;
      } else {
        shippingFee = diff;
        convenienceFee = 0;
      }

      await Order.updateOne(
        { _id: o._id },
        { $set: { shippingFee, convenienceFee } }
      );
      console.log(`Updated Order ${o.orderNumber}: total=${total}, subtotal=${subtotal} -> shippingFee=${shippingFee}, convenienceFee=${convenienceFee}`);
      updatedCount++;
    }
  }

  console.log(`Done! Successfully updated ${updatedCount} orders.`);
  await mongoose.disconnect();
}

fix().catch(console.error);
