const OrderService = require('./order.service');
const { ApiResponse } = require('../../utils/apiResponse');

const getUserId = (req) => req.user?._id || req.user?.id;

// Checkout Stock Reservation & Release (Restock)
const reserveCheckout = async (req, res, next) => {
  try {
    const result = await OrderService.reserveCheckout(req.user, req.body);
    return res.json(ApiResponse.success(result, 'Stock reserved for checkout'));
  } catch (err) { next(err); }
};

const releaseCheckout = async (req, res, next) => {
  try {
    const result = await OrderService.releaseCheckout(req.user, req.body);
    return res.json(ApiResponse.success(result, 'Reserved stock restored back to available'));
  } catch (err) { next(err); }
};

// Customer Razorpay Flow
const createRazorpayOrder = async (req, res, next) => {
  try {
    const result = await OrderService.createRazorpayOrder(req.user, req.body);
    return res.json(ApiResponse.success(result, 'Razorpay order initialized and stock reserved'));
  } catch (err) { next(err); }
};

const verifyRazorpayOrder = async (req, res, next) => {
  try {
    const order = await OrderService.verifyAndCreateOrder(req.user, req.body);
    return res.status(201).json(ApiResponse.success(order, 'Payment verified and order placed successfully'));
  } catch (err) { next(err); }
};

// Customer Direct / Simulated / Card / UPI Order Placement
const createOrder = async (req, res, next) => {
  try {
    const order = await OrderService.createOrder(req.user, req.body);
    return res.status(201).json(ApiResponse.success(order, 'Order placed successfully'));
  } catch (err) { next(err); }
};

// Razorpay Webhook handler
const handleRazorpayWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody || req.body;
    const result = await OrderService.handleWebhook(rawBody, signature);
    return res.status(200).json({ received: true, ...result });
  } catch (err) { next(err); }
};

const myOrders = async (req, res, next) => {
  try {
    const result = await OrderService.myOrders(getUserId(req), req.query);
    return res.json(ApiResponse.paginated(result.data, result.pagination));
  } catch (err) { next(err); }
};

const orderDetail = async (req, res, next) => {
  try {
    const order = await OrderService.getDetail(req.params.id, getUserId(req));
    return res.json(ApiResponse.success(order));
  } catch (err) { next(err); }
};

const getTracking = async (req, res, next) => {
  try {
    const tracking = await OrderService.getTracking(req.params.id, getUserId(req));
    return res.json(ApiResponse.success(tracking));
  } catch (err) { next(err); }
};

const trackOrderByNumber = async (req, res, next) => {
  try {
    const order = await OrderService.trackOrderByNumber(req.params.orderNumber);
    return res.json(ApiResponse.success(order));
  } catch (err) { next(err); }
};

const customerCancelOrder = async (req, res, next) => {
  try {
    const order = await OrderService.customerCancelOrder(req.params.id, getUserId(req), req.body?.reason);
    return res.json(ApiResponse.success(order, 'Order cancelled successfully'));
  } catch (err) { next(err); }
};

// Admin Management
const adminListOrders = async (req, res, next) => {
  try {
    const result = await OrderService.adminListOrders(req.query);
    return res.json(ApiResponse.paginated(result.data, result.pagination));
  } catch (err) { next(err); }
};

const adminOrderDetail = async (req, res, next) => {
  try {
    const order = await OrderService.adminGetDetail(req.params.id);
    return res.json(ApiResponse.success(order));
  } catch (err) { next(err); }
};

const addTracking = async (req, res, next) => {
  try {
    const order = await OrderService.addTracking(req.params.id, req.body);
    return res.json(ApiResponse.success(order, 'Tracking updated. WhatsApp sent.'));
  } catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
  try {
    const order = await OrderService.updateStatus(req.params.id, req.body);
    return res.json(ApiResponse.success(order, `Order status updated to ${req.body.status}`));
  } catch (err) { next(err); }
};

const deleteOrder = async (req, res, next) => {
  try {
    const result = await OrderService.deleteOrder(req.params.id);
    return res.json(ApiResponse.success(result, 'Order deleted successfully'));
  } catch (err) { next(err); }
};

// ─── Shiprocket Logistics Integration ─────────────────────────────────────────

const shiprocketService = require('../../services/shiprocket.service');
const Order = require('../../models/order.model');

/**
 * Admin: 1-Click Ship via Shiprocket
 */
const shipViaShiprocket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { packageDetails } = req.body || {};

    const order = await Order.findById(id).populate('user', 'name email phone');
    if (!order) {
      return res.status(404).json(ApiResponse.error('Order not found', 404));
    }

    const shipmentResult = await shiprocketService.createShipment(order, packageDetails);

    // Update order with live Shiprocket identifiers
    order.trackingId = shipmentResult.awbCode || order.trackingId;
    order.courier = shipmentResult.courierName || order.courier;
    order.courierUrl = shipmentResult.courierUrl || order.courierUrl;
    order.shiprocketOrderId = shipmentResult.shiprocketOrderId || order.shiprocketOrderId;
    order.shiprocketShipmentId = shipmentResult.shiprocketShipmentId || order.shiprocketShipmentId;
    order.shippingLabelUrl = shipmentResult.shippingLabelUrl || order.shippingLabelUrl;
    order.pickupScheduledDate = shipmentResult.pickupScheduledDate || order.pickupScheduledDate;
    order.shippingStatus = shipmentResult.shippingStatus || 'AWB Assigned';
    if (packageDetails) {
      order.packageDetails = {
        weight: Number(packageDetails.weight) || 0.5,
        length: Number(packageDetails.length) || 15,
        breadth: Number(packageDetails.breadth) || 12,
        height: Number(packageDetails.height) || 5,
      };
    }

    // Advance status to shipped
    if (order.status !== 'shipped' && order.status !== 'delivered') {
      order.status = 'shipped';
      order.statusHistory.push({
        status: 'shipped',
        note: `Dispatched via Shiprocket (${shipmentResult.courierName || 'Courier'}). AWB: ${shipmentResult.awbCode}`,
        timestamp: new Date(),
      });
    }

    await order.save();

    // Broadcast live update via Socket.IO
    try {
      const { emitOrderUpdate } = require('../../socket');
      emitOrderUpdate(order, 'SHIPPED');
    } catch (_) {}

    return res.json(
      ApiResponse.success(
        {
          order,
          shipment: shipmentResult,
        },
        'Shipment booked with Shiprocket successfully'
      )
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Admin: Fetch Printable Shipping Label
 */
const getShiprocketLabel = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json(ApiResponse.error('Order not found', 404));

    const shipmentId = order.shiprocketShipmentId || req.params.id;
    const labelResult = await shiprocketService.getShippingLabel(shipmentId);
    return res.json(ApiResponse.success(labelResult));
  } catch (err) {
    next(err);
  }
};

/**
 * Public/Customer: Track AWB via Shiprocket
 */
const trackShiprocketOrder = async (req, res, next) => {
  try {
    const { awb } = req.params;
    const tracking = await shiprocketService.trackShipment(awb);
    return res.json(ApiResponse.success(tracking));
  } catch (err) {
    next(err);
  }
};

/**
 * Public: Check Pincode Delivery Serviceability
 */
const checkDeliveryPincode = async (req, res, next) => {
  try {
    const { pincode, weight = 0.5, cod = 0 } = req.body;
    if (!pincode) {
      return res.status(400).json(ApiResponse.error('Pincode is required', 400));
    }
    const result = await shiprocketService.checkServiceability({
      deliveryPincode: pincode,
      weight: Number(weight) || 0.5,
      cod: Number(cod) || 0,
    });
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

/**
 * Public: Shiprocket Live Status Webhook
 */
const handleShiprocketWebhook = async (req, res, next) => {
  try {
    const payload = req.body || {};
    const { awb, current_status } = payload;

    if (awb && current_status) {
      const order = await Order.findOne({ trackingId: awb });
      if (order) {
        order.shippingStatus = current_status;
        const normalized = current_status.toLowerCase();

        if (normalized.includes('delivered') && order.status !== 'delivered') {
          order.status = 'delivered';
          order.statusHistory.push({
            status: 'delivered',
            note: `Confirmed delivery via Shiprocket (${order.courier || 'Courier'})`,
            timestamp: new Date(),
          });
        } else if (normalized.includes('out for delivery') && order.status !== 'out_for_delivery') {
          order.status = 'out_for_delivery';
          order.statusHistory.push({
            status: 'out_for_delivery',
            note: 'Out for delivery to customer doorstep',
            timestamp: new Date(),
          });
        }

        await order.save();

        try {
          const { emitOrderUpdate } = require('../../socket');
          emitOrderUpdate(order, 'STATUS_UPDATED');
        } catch (_) {}
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  reserveCheckout,
  releaseCheckout,
  createRazorpayOrder,
  verifyRazorpayOrder,
  createOrder,
  handleRazorpayWebhook,
  myOrders,
  orderDetail,
  getTracking,
  adminListOrders,
  adminOrderDetail,
  addTracking,
  updateStatus,
  deleteOrder,
  trackOrderByNumber,
  customerCancelOrder,
  shipViaShiprocket,
  getShiprocketLabel,
  trackShiprocketOrder,
  checkDeliveryPincode,
  handleShiprocketWebhook,
};
