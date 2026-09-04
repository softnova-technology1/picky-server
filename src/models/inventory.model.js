const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    reserved: { type: Number, default: 0 }, // reserved during checkout
  },
  { timestamps: true }
);


module.exports = mongoose.model('Inventory', inventorySchema);
