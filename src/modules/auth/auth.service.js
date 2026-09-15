const AppError = require('../../utils/appError');
const redis = require('../../config/redis');
const User = require('../../models/user.model');
const NotificationService = require('../../services/notification.service');
const jwt = require('jsonwebtoken');

const OTP_EXPIRE = parseInt(process.env.OTP_EXPIRE_SECONDS) || 300;
const OTP_MAX_ATTEMPTS = 5; // audit fix #5 — Redis-backed attempt cap per phone

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const signTokens = (userId) => ({
  accessToken: jwt.sign({ id: userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  }),
  refreshToken: jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  }),
});

const AuthService = {
  // Customer WhatsApp OTP Login
  async sendOTP(phone) {
    const otp = generateOTP();
    await redis.set(`otp:${phone}`, otp, 'EX', OTP_EXPIRE);
    // Reset attempt counter when a new OTP is issued
    await redis.del(`otp_attempts:${phone}`);
    await NotificationService.sendOTP(phone, otp);
  },

  async verifyOTP(phone, otp) {
    // audit fix #5 — Redis-backed brute-force protection per phone number
    // Resists IP rotation attacks that bypass the express-rate-limit counter.
    const attemptKey = `otp_attempts:${phone}`;
    const attempts = parseInt((await redis.get(attemptKey)) || '0');

    if (attempts >= OTP_MAX_ATTEMPTS) {
      throw new AppError(
        `Too many OTP attempts. Request a new OTP to try again.`,
        429
      );
    }

    const stored = await redis.get(`otp:${phone}`);
    if (!stored || stored !== otp) {
      // Increment attempt counter — expires with the OTP window
      await redis.set(attemptKey, attempts + 1, 'EX', OTP_EXPIRE);
      throw new AppError('Invalid or expired OTP', 400);
    }

    // Success — clear OTP and attempt counter
    await redis.del(`otp:${phone}`);
    await redis.del(attemptKey);

    let user = await User.findOne({ phone });
    if (!user) user = await User.create({ phone });

    const tokens = signTokens(user._id.toString());
    await redis.set(
      `refresh:${user._id}`,
      tokens.refreshToken,
      'EX',
      7 * 24 * 60 * 60
    );
    return { ...tokens, user: { id: user._id, phone: user.phone, name: user.name, role: user.role } };
  },

  // Admin Direct Email & Encrypted Password Authentication
  async adminLogin(email, password) {
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      throw new AppError('Invalid admin credentials', 401);
    }

    if (user.role !== 'admin') {
      throw new AppError('Access denied: Unauthorized admin account', 403);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Invalid admin credentials', 401);
    }

    const tokens = signTokens(user._id.toString());
    await redis.set(
      `refresh:${user._id}`,
      tokens.refreshToken,
      'EX',
      7 * 24 * 60 * 60
    );

    return {
      ...tokens,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    };
  },

  async refreshToken(token) {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const stored = await redis.get(`refresh:${decoded.id}`);
    if (!stored || stored !== token) throw new AppError('Invalid refresh token', 401);
    const tokens = signTokens(decoded.id);
    await redis.set(`refresh:${decoded.id}`, tokens.refreshToken, 'EX', 7 * 24 * 60 * 60);
    return tokens;
  },

  /**
   * audit fix #8 — logout now takes userId (from JWT via authenticate middleware),
   * not a raw refresh token from the request body.
   * The old approach accepted anonymous calls and silently failed on missing tokens.
   */
  async logout(userId) {
    if (!userId) return;
    await redis.del(`refresh:${userId}`);
  },

  async updateProfile(userId, { name, email, defaultAddress }) {
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (email !== undefined) update.email = email.toLowerCase().trim();
    if (defaultAddress !== undefined) update.defaultAddress = defaultAddress;

    const user = await User.findByIdAndUpdate(userId, update, { new: true }).select('-password -__v').lean();
    if (!user) throw new AppError('User not found', 404);
    return user;
  },
};

module.exports = AuthService;
