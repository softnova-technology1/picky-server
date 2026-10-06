const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
    sku: { type: String, trim: true, uppercase: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    // NOTE: a "reserved" field was removed — re-add when implementing
    // a proper reserve-then-confirm checkout flow with session timeouts.
  },
  { timestamps: true }
);


module.exports = mongoose.model('Inventory', inventorySchema);
