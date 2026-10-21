const AuthService = require('./auth.service');
const { ApiResponse } = require('../../utils/apiResponse');

const sendOTP = async (req, res, next) => {
  try {
    await AuthService.sendOTP(req.body.phone);
    return res.json(ApiResponse.success(null, 'OTP sent successfully'));
  } catch (err) { next(err); }
};

const verifyOTP = async (req, res, next) => {
  try {
    const tokens = await AuthService.verifyOTP(req.body.phone, req.body.otp);
    return res.json(ApiResponse.success(tokens, 'Login successful'));
  } catch (err) { next(err); }
};

const googleLogin = async (req, res, next) => {
  try {
    const tokens = await AuthService.googleLogin(req.body);
    return res.json(ApiResponse.success(tokens, 'Google authentication successful'));
  } catch (err) { next(err); }
};

const adminLogin = async (req, res, next) => {
  try {
    const tokens = await AuthService.adminLogin(req.body.email, req.body.password);
    return res.json(ApiResponse.success(tokens, 'Admin authenticated successfully'));
  } catch (err) { next(err); }
};

const refreshToken = async (req, res, next) => {
  try {
    const tokens = await AuthService.refreshToken(req.body.refreshToken);
    return res.json(ApiResponse.success(tokens));
  } catch (err) { next(err); }
};

const logout = async (req, res, next) => {
  try {
    // audit fix #8 — use userId from authenticated token, not raw body refresh token
    const userId = req.user?._id || req.user?.id;
    await AuthService.logout(userId);
    return res.json(ApiResponse.success(null, 'Logged out successfully'));
  } catch (err) { next(err); }
};

const getMe = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const user = await AuthService.getMe(userId, req.user);
    return res.json(ApiResponse.success(user));
  } catch (err) { next(err); }
};

const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const user = await AuthService.updateProfile(userId, req.body);
    return res.json(ApiResponse.success(user, 'Profile updated successfully'));
  } catch (err) { next(err); }
};

const getAddresses = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const addresses = await AuthService.getAddresses(userId);
    return res.json(ApiResponse.success(addresses, 'Addresses retrieved successfully'));
  } catch (err) { next(err); }
};

const addAddress = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const result = await AuthService.addAddress(userId, req.body);
    return res.json(ApiResponse.success(result, 'Address saved successfully'));
  } catch (err) { next(err); }
};

const setDefaultAddress = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const result = await AuthService.setDefaultAddress(userId, req.params.id);
    return res.json(ApiResponse.success(result, 'Default address updated'));
  } catch (err) { next(err); }
};

const deleteAddress = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const result = await AuthService.deleteAddress(userId, req.params.id);
    return res.json(ApiResponse.success(result, 'Address removed successfully'));
  } catch (err) { next(err); }
};

const changePassword = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const result = await AuthService.changePassword(userId, req.body);
    return res.json(ApiResponse.success(result, 'Password updated successfully'));
  } catch (err) { next(err); }
};

module.exports = {
  sendOTP,
  verifyOTP,
  googleLogin,
  adminLogin,
  refreshToken,
  logout,
  getMe,
  updateProfile,
  getAddresses,
  addAddress,
  setDefaultAddress,
  deleteAddress,
  changePassword,
};
