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
    await AuthService.logout(req.body.refreshToken);
    return res.json(ApiResponse.success(null, 'Logged out'));
  } catch (err) { next(err); }
};

const getMe = async (req, res, next) => {
  try {
    return res.json(ApiResponse.success(req.user));
  } catch (err) { next(err); }
};

module.exports = { sendOTP, verifyOTP, adminLogin, refreshToken, logout, getMe };
