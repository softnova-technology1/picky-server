const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { validate } = require('../../middleware/validate.middleware');
const { sendOtpSchema, verifyOtpSchema, refreshTokenSchema } = require('./auth.schema');
const { authenticate } = require('../../middleware/auth.middleware');

router.post('/send-otp', validate(sendOtpSchema), authController.sendOTP);
router.post('/verify-otp', validate(verifyOtpSchema), authController.verifyOTP);
router.post('/admin/login', authController.adminLogin);
router.post('/refresh', validate(refreshTokenSchema), authController.refreshToken);
// audit fix #8 — logout now requires a valid access token; anonymous calls return 401
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.patch('/profile', authenticate, authController.updateProfile);

// Address Management Endpoints (Persisted in MongoDB)
router.get('/addresses', authenticate, authController.getAddresses);
router.post('/addresses', authenticate, authController.addAddress);
router.patch('/addresses/:id/default', authenticate, authController.setDefaultAddress);
router.delete('/addresses/:id', authenticate, authController.deleteAddress);

module.exports = router;
