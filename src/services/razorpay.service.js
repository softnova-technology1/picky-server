const crypto = require('crypto');
const logger = require('../utils/logger');
let Razorpay;
try {
  Razorpay = require('razorpay');
} catch (_) {
  Razorpay = null;
}

const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_picky_dev_key';
const key_secret = process.env.RAZORPAY_KEY_SECRET || 'picky_razorpay_secret_dev_key';
const webhook_secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

let razorpayClient = null;
const isLiveKey = key_id && !key_id.includes('mock') && !key_id.includes('dev_key');

if (Razorpay && isLiveKey) {
  try {
    razorpayClient = new Razorpay({
      key_id,
      key_secret,
    });
    logger.info('✅ Razorpay client initialized with live test/prod keys');
  } catch (err) {
    logger.warn(`Razorpay init error: ${err.message}`);
  }
}

const RazorpayService = {
  /**
   * Creates a Razorpay Order
   * @param {Object} params
   * @param {number} params.amountInRupees Amount in INR (will be converted to paise)
   * @param {string} params.receipt Unique order receipt string
   * @param {Object} [params.notes] Metadata
   * @returns {Promise<{ id: string, amount: number, currency: string, keyId: string }>}
   */
  async createOrder({ amountInRupees, receipt, notes = {} }) {
    const amountInPaise = Math.round(Number(amountInRupees) * 100);

    if (razorpayClient) {
      const order = await razorpayClient.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: receipt ? String(receipt).slice(0, 40) : undefined,
        notes,
      });
      return {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: key_id,
      };
    }

    // Dev/Mock Fallback when running without live Razorpay credentials
    const mockOrderId = `order_${crypto.randomBytes(8).toString('hex')}`;
    logger.info(`[MOCK RAZORPAY] Created order ${mockOrderId} for Rs.${amountInRupees} (${amountInPaise} paise)`);
    return {
      id: mockOrderId,
      amount: amountInPaise,
      currency: 'INR',
      keyId: key_id,
    };
  },

  /**
   * Verifies Razorpay payment signature
   * audit fix #3 — removed the `startsWith('order_')` bypass that silently
   * skipped real signature verification in production (Razorpay always uses 'order_' prefix)
   */
  verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    if (!razorpayOrderId || !razorpayPaymentId) return false;

    // Only bypass in dev mode with mock credentials
    if (!isLiveKey) {
      logger.info(`[MOCK RAZORPAY] Signature bypassed for dev order ${razorpayOrderId}`);
      return true;
    }

    // Production — always verify HMAC SHA256 signature
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', key_secret)
      .update(body)
      .digest('hex');

    return expectedSignature === razorpaySignature;
  },

  /**
   * Verifies Razorpay webhook signature (audit fix #2)
   * Used in POST /orders/razorpay/webhook to confirm payload is from Razorpay
   */
  verifyWebhookSignature(rawBody, signature) {
    if (!webhook_secret) {
      logger.warn('[RAZORPAY WEBHOOK] RAZORPAY_WEBHOOK_SECRET not set — skipping verification in dev');
      return true;
    }
    const expected = crypto
      .createHmac('sha256', webhook_secret)
      .update(rawBody)
      .digest('hex');
    return expected === signature;
  },
};

module.exports = RazorpayService;
