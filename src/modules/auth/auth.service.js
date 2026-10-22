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
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15d',
  }),
  refreshToken: jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '15d',
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
    if (!user) {
      user = await User.create({ phone });
      try {
        const AdminNotificationService = require('../../services/adminNotification.service');
        AdminNotificationService.notifyNewCustomer(user);
      } catch {}
    }

    const tokens = signTokens(user._id.toString());
    await redis.set(
      `refresh:${user._id}`,
      tokens.refreshToken,
      'EX',
      15 * 24 * 60 * 60
    );
    return {
      ...tokens,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        role: user.role,
        defaultAddress: user.defaultAddress,
        addresses: user.addresses || [],
      },
    };
  },

  // Customer Google OAuth Authentication
  async googleLogin({ idToken, accessToken }) {
    let email, name, picture, googleId;

    if (idToken) {
      try {
        const { OAuth2Client } = require('google-auth-library');
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        const ticket = await client.verifyIdToken({
          idToken,
          audience: process.env.GOOGLE_CLIENT_ID ? [process.env.GOOGLE_CLIENT_ID] : undefined,
        });
        const payload = ticket.getPayload();
        email = payload.email;
        name = payload.name;
        picture = payload.picture;
        googleId = payload.sub;
      } catch (tokenErr) {
        // Fallback: If verification by client library fails due to audience or token format, try Google tokeninfo endpoint
        const axios = require('axios');
        const res = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
        email = res.data.email;
        name = res.data.name;
        picture = res.data.picture;
        googleId = res.data.sub;
      }
    } else if (accessToken) {
      const axios = require('axios');
      const res = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      email = res.data.email;
      name = res.data.name;
      picture = res.data.picture;
      googleId = res.data.sub;
    } else {
      throw new AppError('Google authentication token is required', 400);
    }

    if (!email) {
      throw new AppError('Unable to retrieve email from Google account', 400);
    }

    let user = await User.findOne({
      $or: [{ googleId }, { email: email.toLowerCase().trim() }],
    });

    if (!user) {
      user = await User.create({
        name: name || 'Google User',
        email: email.toLowerCase().trim(),
        avatar: picture || '',
        googleId,
        role: 'customer',
      });
      try {
        const AdminNotificationService = require('../../services/adminNotification.service');
        AdminNotificationService.notifyNewCustomer(user);
      } catch {}
    } else {
      // Update missing fields if available
      let changed = false;
      if (!user.googleId && googleId) {
        user.googleId = googleId;
        changed = true;
      }
      if (!user.avatar && picture) {
        user.avatar = picture;
        changed = true;
      }
      if (!user.name && name) {
        user.name = name;
        changed = true;
      }
      if (changed) await user.save();
    }

    if (user.isActive === false) {
      throw new AppError('Your account has been deactivated. Please contact support.', 403);
    }

    const tokens = signTokens(user._id.toString());
    await redis.set(
      `refresh:${user._id}`,
      tokens.refreshToken,
      'EX',
      15 * 24 * 60 * 60
    );

    return {
      ...tokens,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        defaultAddress: user.defaultAddress,
        addresses: user.addresses || [],
      },
    };
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

    // Block disabled admin accounts at login itself
    if (user.isActive === false) {
      throw new AppError('This admin account has been disabled. Contact support.', 403);
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
      15 * 24 * 60 * 60
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

    const user = await User.findById(decoded.id).select('isActive passwordChangedAt').lean();
    if (!user || user.isActive === false) {
      await redis.del(`refresh:${decoded.id}`);
      throw new AppError('Account is disabled or does not exist', 401);
    }

    if (user.passwordChangedAt) {
      const changedTimestamp = parseInt(new Date(user.passwordChangedAt).getTime() / 1000, 10);
      if (decoded.iat < changedTimestamp) {
        await redis.del(`refresh:${decoded.id}`);
        throw new AppError('Password has been changed. Please log in again.', 401);
      }
    }

    const tokens = signTokens(decoded.id);
    await redis.set(`refresh:${decoded.id}`, tokens.refreshToken, 'EX', 15 * 24 * 60 * 60);
    return tokens;
  },

  /**
   * audit fix #8 — logout now takes userId (from JWT via authenticate middleware),
   * not a raw refresh token from the request body.
   * The old approach accepted anonymous calls and silently failed on missing tokens.
   */
  async logout(userId) {
    if (!userId) return;
    await redis.del(`refresh:${userId.toString()}`); // ensure string key for Redis
  },

  async getMe(userId, fallbackUser) {
    if (!userId) return fallbackUser;
    let user = await User.findById(userId).select('-password -__v').lean();
    if (!user) return fallbackUser;

    // Auto-link phone from defaultAddress, addresses or latest Order if phone slot is empty
    if (!user.phone || !user.phone.trim()) {
      try {
        let phoneCandidate = '';
        if (user.defaultAddress?.phone) {
          phoneCandidate = user.defaultAddress.phone;
        } else if (Array.isArray(user.addresses) && user.addresses.length > 0) {
          const withPhone = user.addresses.find((a) => a.phone);
          if (withPhone) phoneCandidate = withPhone.phone;
        }

        if (!phoneCandidate) {
          const Order = require('../../models/order.model');
          const lastOrder = await Order.findOne({ user: user._id, 'shippingAddress.phone': { $exists: true, $ne: '' } })
            .sort({ createdAt: -1 })
            .select('shippingAddress.phone')
            .lean();
          if (lastOrder?.shippingAddress?.phone) {
            phoneCandidate = lastOrder.shippingAddress.phone;
          }
        }

        const cleanPhone = (phoneCandidate || '').toString().replace(/\D/g, '').slice(-10);
        if (cleanPhone && cleanPhone.length === 10) {
          await User.findByIdAndUpdate(user._id, { $set: { phone: cleanPhone } });
          user.phone = cleanPhone;
        }
      } catch (syncErr) {
        // Non-critical auto-link fallback
      }
    }

    return user;
  },

  async updateProfile(userId, { name, email, phone, dob, dateOfBirth, defaultAddress, addresses }) {
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (email !== undefined) update.email = email.toLowerCase().trim();
    if (phone !== undefined && phone !== null) {
      const cleanPhone = phone.toString().replace(/\D/g, '').slice(-10);
      if (cleanPhone) update.phone = cleanPhone;
    }
    const dobVal = dob !== undefined ? dob : dateOfBirth;
    if (dobVal !== undefined && dobVal !== null) update.dob = typeof dobVal === 'string' ? dobVal.trim() : dobVal;
    if (defaultAddress !== undefined) update.defaultAddress = defaultAddress;
    if (addresses !== undefined) update.addresses = addresses;

    const user = await User.findByIdAndUpdate(userId, update, { new: true }).select('-password -__v').lean();
    if (!user) throw new AppError('User not found', 404);
    return user;
  },

  async getAddresses(userId) {
    const user = await User.findById(userId).select('addresses defaultAddress').lean();
    if (!user) throw new AppError('User not found', 404);
    return user.addresses || [];
  },

  async addAddress(userId, addressData) {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    const hasAddresses = Array.isArray(user.addresses) && user.addresses.length > 0;
    const shouldBeDefault = Boolean(addressData.isDefault || !hasAddresses);

    const cleanAddressPhone = (addressData.phone || '').toString().replace(/\D/g, '').slice(-10);

    // If customer has no linked phone number (e.g. signed in via Google OAuth), link phone from delivery address
    if ((!user.phone || !user.phone.trim()) && cleanAddressPhone && cleanAddressPhone.length === 10) {
      user.phone = cleanAddressPhone;
    }

    const newAddress = {
      fullName: (addressData.fullName || user.name || '').trim(),
      phone: (cleanAddressPhone || user.phone || addressData.phone || '').trim(),
      email: (addressData.email || user.email || '').trim(),
      street: (addressData.street || '').trim(),
      city: (addressData.city || '').trim(),
      state: (addressData.state || '').trim(),
      pincode: (addressData.pincode || '').trim(),
      landmark: (addressData.landmark || '').trim(),
      isDefault: shouldBeDefault,
    };

    if (shouldBeDefault && Array.isArray(user.addresses)) {
      user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
      user.defaultAddress = { ...newAddress };
    }

    if (!user.addresses) user.addresses = [];
    user.addresses.push(newAddress);

    if (!user.defaultAddress || !user.defaultAddress.street) {
      user.defaultAddress = { ...newAddress };
    }

    await user.save();

    return {
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        defaultAddress: user.defaultAddress,
        addresses: user.addresses || [],
      },
      phone: user.phone,
      addresses: user.addresses,
      defaultAddress: user.defaultAddress,
      addedAddress: user.addresses[user.addresses.length - 1],
    };
  },

  async setDefaultAddress(userId, addressId) {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    let found = null;
    (user.addresses || []).forEach((addr) => {
      if (addr._id.toString() === addressId.toString()) {
        addr.isDefault = true;
        found = addr;
      } else {
        addr.isDefault = false;
      }
    });

    if (!found) throw new AppError('Address not found', 404);
    user.defaultAddress = {
      fullName: found.fullName,
      phone: found.phone,
      email: found.email,
      street: found.street,
      city: found.city,
      state: found.state,
      pincode: found.pincode,
      landmark: found.landmark,
    };

    await user.save();
    return { addresses: user.addresses, defaultAddress: user.defaultAddress };
  },

  async deleteAddress(userId, addressId) {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    const prevLength = user.addresses?.length || 0;
    user.addresses = (user.addresses || []).filter(
      (addr) => addr._id.toString() !== addressId.toString()
    );

    if (user.addresses.length === prevLength) {
      throw new AppError('Address not found', 404);
    }

    const hasDefault = user.addresses.some((a) => a.isDefault);
    if (!hasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
      user.defaultAddress = { ...user.addresses[0].toObject() };
    } else if (user.addresses.length === 0) {
      user.defaultAddress = null;
    }

    await user.save();
    return { addresses: user.addresses, defaultAddress: user.defaultAddress };
  },

  async changePassword(userId, { currentPassword, newPassword }) {
    if (!newPassword || newPassword.length < 6) {
      throw new AppError('New password must be at least 6 characters long', 400);
    }
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    // If user already has an established password, verify the current password
    if (user.password) {
      if (!currentPassword) {
        throw new AppError('Current password is required', 400);
      }
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        throw new AppError('Current password does not match', 400);
      }
    }

    user.password = newPassword;
    await user.save();
    return { message: 'Password updated successfully' };
  },
};

module.exports = AuthService;
