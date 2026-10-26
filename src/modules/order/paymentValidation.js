const AppError = require('../../utils/appError');

const assertPaymentMatchesIntent = ({ intent, razorpayOrderId, razorpayPaymentId, gatewayOrder, payment }) => {
  if (!intent || !gatewayOrder || !payment) {
    throw new AppError('Payment could not be verified with Razorpay', 400);
  }

  const expectedAmount = Math.round(Number(intent.pricing?.total) * 100);
  const userId = intent.user?.toString();

  if (
    gatewayOrder.id !== razorpayOrderId ||
    payment.order_id !== razorpayOrderId ||
    payment.id !== razorpayPaymentId ||
    gatewayOrder.amount !== expectedAmount ||
    payment.amount !== expectedAmount ||
    gatewayOrder.currency !== 'INR' ||
    payment.currency !== 'INR' ||
    payment.status !== 'captured' ||
    gatewayOrder.notes?.userId !== userId
  ) {
    throw new AppError('Razorpay payment does not match this checkout', 400);
  }
};

const assertDirectOrderIsAllowed = ({ environment, paymentMethod, paymentStatus, razorpayPaymentId, razorpayOrderId }) => {
  // No direct endpoint may mark an order paid. Missing NODE_ENV also stays secure.
  if (paymentStatus === 'paid' || razorpayPaymentId || razorpayOrderId) {
    throw new AppError('Payment details cannot be supplied to direct order creation', 403);
  }
  if (environment !== 'development' && paymentMethod !== 'cod') {
    throw new AppError('Online orders must use the verified Razorpay checkout flow', 403);
  }
};

module.exports = { assertPaymentMatchesIntent, assertDirectOrderIsAllowed };
