const mongoose = require('mongoose');

const customizationSchema = new mongoose.Schema(
  {
    pageId: { type: String, required: true, unique: true }, // e.g., 'home', 'products', 'about'
    sections: { type: mongoose.Schema.Types.Mixed, default: [] }, // Array of section objects
  },
  { timestamps: true }
);

module.exports = mongoose.model('Customization', customizationSchema);
