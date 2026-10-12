const Notification = require('../../models/notification.model');
const ContactInquiry = require('../../models/contact.model');
const Order = require('../../models/order.model');
const Product = require('../../models/product.model');
const Coupon = require('../../models/coupon.model');
const User = require('../../models/user.model');
const { sendSuccess } = require('../../utils/apiResponse');
const AppError = require('../../utils/appError');

const NotificationController = {
  /**
   * Sync and ensure all real database entities have real notifications in MongoDB
   */
  async syncWithDatabase() {
    try {
      // 1. Sync all real Contact Inquiries from MongoDB
      const inquiries = await ContactInquiry.find({}).sort({ createdAt: -1 }).lean();
      for (const inq of inquiries) {
        const entityKey = `contact-${inq._id}`;
        const exists = await Notification.findOne({ entityKey });
        if (!exists) {
          const hasAtt = Boolean(inq.file?.url);
          const snippet = inq.message ? (inq.message.length > 90 ? `${inq.message.slice(0, 90)}...` : inq.message) : 'Support Inquiry';
          await Notification.create({
            entityKey,
            type: 'contact',
            category: 'Contact & Support',
            title: `New Support Inquiry from ${inq.fullName || 'Customer'}`,
            message: hasAtt ? `${snippet} (📎 Attachment: ${inq.file?.originalName || 'file'})` : snippet,
            unread: !inq.isRead,
            starred: false,
            link: '/softpicky-sn2026/settings?tab=notifications',
            linkText: 'View Inquiry',
            metadata: {
              inquiryId: inq._id,
              fullName: inq.fullName,
              email: inq.email || '',
              phone: inq.phone || '',
              hasAttachment: hasAtt,
              fileUrl: inq.file?.url || '',
              fileName: inq.file?.originalName || '',
              fileMime: inq.file?.mimeType || '',
              fileSize: inq.file?.size || 0,
            },
            createdAt: inq.createdAt || new Date(),
          });
        }
      }

      // 2. Sync all real Orders from MongoDB
      const orders = await Order.find({}).populate('user', 'name email').sort({ createdAt: -1 }).lean();
      for (const ord of orders) {
        const entityKey = `order-${ord._id}`;
        const exists = await Notification.findOne({ entityKey });
        if (!exists) {
          const customerName = ord.user?.name || 'Customer';
          const totalAmt = ord.total ? `₹${ord.total.toLocaleString('en-IN')}` : '₹0';
          const itemsCount = ord.items?.length || 1;
          await Notification.create({
            entityKey,
            type: 'order',
            category: 'Orders',
            title: `New Order #${ord.orderNumber} received`,
            message: `${customerName} placed order for ${totalAmt} (${itemsCount} item${itemsCount > 1 ? 's' : ''}) with Online Payment.`,
            unread: true,
            starred: false,
            link: '/softpicky-sn2026/orders',
            linkText: 'View Order',
            metadata: {
              orderId: ord._id,
              orderNumber: ord.orderNumber,
              customerName,
              total: ord.total,
            },
            createdAt: ord.createdAt || new Date(),
          });
        }
      }

      // 3. Sync real Low Stock & Products from MongoDB
      const products = await Product.find({ isActive: true }).sort({ createdAt: -1 }).lean();
      for (const prod of products) {
        if (prod.stock !== undefined && prod.stock <= 25) {
          const entityKey = `inventory-lowstock-${prod._id}`;
          const exists = await Notification.findOne({ entityKey });
          if (!exists) {
            await Notification.create({
              entityKey,
              type: 'inventory',
              category: 'Inventory',
              title: `Low Stock Alert: ${prod.name}`,
              message: `Stock level dropped to ${prod.stock} units remaining. Please reorder from supplier.`,
              unread: true,
              starred: true,
              link: '/softpicky-sn2026/inventory',
              linkText: 'Inspect Stock',
              metadata: {
                productId: prod._id,
                productName: prod.name,
                stock: prod.stock,
              },
              createdAt: prod.updatedAt || prod.createdAt || new Date(),
            });
          }
        }

        // Real Products in Catalog from MongoDB
        const prodEntityKey = `product-${prod._id}`;
        const prodExists = await Notification.findOne({ entityKey: prodEntityKey });
        if (!prodExists) {
          await Notification.create({
            entityKey: prodEntityKey,
            type: 'product',
            category: 'Products',
            title: `Product in Catalog: ${prod.name}`,
            message: `Product ${prod.name} (SKU: ${prod.sku || 'N/A'}, Price: ₹${prod.price || 0}) is live in store catalog.`,
            unread: false,
            starred: false,
            link: '/softpicky-sn2026/products',
            linkText: 'View Product',
            metadata: {
              productId: prod._id,
              name: prod.name,
              price: prod.price,
              stock: prod.stock,
            },
            createdAt: prod.createdAt || new Date(),
          });
        }
      }

      // 4. Sync real active coupons from MongoDB
      const coupons = await Coupon.find({ isActive: true }).lean();
      for (const coup of coupons) {
        const entityKey = `coupon-${coup._id}`;
        const exists = await Notification.findOne({ entityKey });
        if (!exists) {
          await Notification.create({
            entityKey,
            type: 'coupon',
            category: 'Coupons & Discounts',
            title: `Coupon Active: ${coup.code}`,
            message: `Coupon ${coup.code} is active offering promotional discounts for store shoppers.`,
            unread: false,
            starred: false,
            link: '/softpicky-sn2026/coupons',
            linkText: 'Manage Coupons',
            metadata: {
              couponId: coup._id,
              code: coup.code,
            },
            createdAt: coup.createdAt || new Date(),
          });
        }
      }

      // 5. Sync real customers from MongoDB
      const customers = await User.find({ role: 'customer' }).sort({ createdAt: -1 }).lean();
      for (const cust of customers) {
        const entityKey = `customer-${cust._id}`;
        const exists = await Notification.findOne({ entityKey });
        if (!exists) {
          await Notification.create({
            entityKey,
            type: 'customer',
            category: 'Customers',
            title: `New Customer Registration: ${cust.name}`,
            message: `${cust.name} (${cust.email || 'Mobile user'}) created an account on Picky store.`,
            unread: true,
            starred: false,
            link: '/softpicky-sn2026/customers',
            linkText: 'View Customer',
            metadata: {
              customerId: cust._id,
              name: cust.name,
              email: cust.email,
            },
            createdAt: cust.createdAt || new Date(),
          });
        }
      }
    } catch (err) {
      console.warn('Sync notifications note:', err.message);
    }
  },

  /**
   * List notifications for Admin (returns 100% live DB notifications)
   */
  async list(req, res, next) {
    try {
      // Ensure all real database entities have authentic notifications
      await NotificationController.syncWithDatabase();

      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
      const skip = (page - 1) * limit;

      const filter = {};
      if (req.query.type && req.query.type !== 'all') {
        filter.type = req.query.type;
      }
      if (req.query.unread === 'true') {
        filter.unread = true;
      }

      const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Notification.countDocuments(filter),
        Notification.countDocuments({ unread: true }),
      ]);

      return sendSuccess(
        res,
        { notifications, unreadCount },
        200,
        { page, limit, total, totalPages: Math.ceil(total / limit) }
      );
    } catch (err) {
      next(err);
    }
  },

  /**
   * Mark single notification as read
   */
  async markRead(req, res, next) {
    try {
      const notif = await Notification.findByIdAndUpdate(
        req.params.id,
        { unread: false },
        { new: true }
      );
      if (!notif) {
        return next(new AppError('Notification not found', 404));
      }
      return sendSuccess(res, notif, 200, null, 'Notification marked as read');
    } catch (err) {
      next(err);
    }
  },

  /**
   * Mark all notifications as read
   */
  async markAllRead(req, res, next) {
    try {
      await Notification.updateMany({ unread: true }, { unread: false });
      return sendSuccess(res, null, 200, null, 'All notifications marked as read');
    } catch (err) {
      next(err);
    }
  },

  /**
   * Toggle star on notification
   */
  async toggleStar(req, res, next) {
    try {
      const notif = await Notification.findById(req.params.id);
      if (!notif) {
        return next(new AppError('Notification not found', 404));
      }
      notif.starred = !notif.starred;
      await notif.save();
      return sendSuccess(res, notif);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Delete notification
   */
  async delete(req, res, next) {
    try {
      const notif = await Notification.findByIdAndDelete(req.params.id);
      if (!notif) {
        return next(new AppError('Notification not found', 404));
      }
      return sendSuccess(res, null, 200, null, 'Notification deleted');
    } catch (err) {
      next(err);
    }
  },
};

module.exports = NotificationController;
