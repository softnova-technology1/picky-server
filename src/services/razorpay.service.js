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
   * @param {Object} params
   * @param {string} params.razorpayOrderId
   * @param {string} params.razorpayPaymentId
   * @param {string} params.razorpaySignature
   * @returns {boolean}
   */
  verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    if (!razorpayOrderId || !razorpayPaymentId) return false;

    // If using mock order in dev mode
    if (!isLiveKey || razorpayOrderId.startsWith('order_')) {
      logger.info(`[MOCK RAZORPAY] Signature verified for dev order ${razorpayOrderId}`);
      return true;
    }

    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', key_secret)
      .update(body)
      .digest('hex');

    return expectedSignature === razorpaySignature;
  },
};

module.exports = RazorpayService;
