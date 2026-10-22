const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    avatar: { type: String, default: '' },
    phone: { type: String, trim: true, sparse: true },
    email: { type: String, trim: true, lowercase: true, sparse: true },
    googleId: { type: String, sparse: true },
    dob: { type: String, trim: true },
    password: { type: String }, // Hashed with bcrypt for admin / password auth
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    defaultAddress: {
      fullName: String,
      phone: String,
      email: String,
      street: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String,
    },
    addresses: [
      {
        fullName: String,
        phone: String,
        email: String,
        street: String,
        city: String,
        state: String,
        pincode: String,
        landmark: String,
        isDefault: { type: Boolean, default: false },
      },
    ],
    orderCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    passwordChangedAt: { type: Date },
  },
  { timestamps: true }
);

// Password hashing middleware before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  // Mark passwordChangedAt so tokens issued before this time are immediately invalidated
  this.passwordChangedAt = new Date();
  next();
});

// Compare password helper
userSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
