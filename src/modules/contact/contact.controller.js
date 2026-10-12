const path = require('path');
const fs = require('fs');
const ContactInquiry = require('../../models/contact.model');
const Notification = require('../../models/notification.model');
const { sendSuccess, sendError } = require('../../utils/apiResponse');
const AppError = require('../../utils/appError');
const logger = require('../../utils/logger');

const ContactController = {
  /**
   * Submit Contact Form (Public Endpoint)
   * Email is optional, file upload is supported.
   */
  async submit(req, res, next) {
    try {
      const { fullName, email, phone, message } = req.body;

      if (!fullName || !fullName.trim()) {
        return next(new AppError('Full name is required', 400));
      }
      if (!message || !message.trim()) {
        return next(new AppError('Message is required', 400));
      }

      let fileData = {
        url: '',
        originalName: '',
        mimeType: '',
        size: 0,
        filename: '',
      };

      if (req.file) {
        // Construct accessible static URL
        const host = req.get('host');
        const protocol = req.protocol || 'http';
        const fileUrl = `${protocol}://${host}/uploads/contact/${req.file.filename}`;

        fileData = {
          url: fileUrl,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          filename: req.file.filename,
        };
      }

      // 1. Create Contact Inquiry in MongoDB
      const inquiry = await ContactInquiry.create({
        fullName: fullName.trim(),
        email: email ? email.trim() : '',
        phone: phone ? phone.trim() : '',
        message: message.trim(),
        file: fileData,
        isRead: false,
        status: 'unread',
      });

      // 2. Create In-App Admin Notification in MongoDB
      const snippet = message.trim().length > 90 ? `${message.trim().slice(0, 90)}...` : message.trim();
      const notifTitle = `New Support Inquiry from ${fullName.trim()}`;
      const notifMessage = fileData.url
        ? `${snippet} (📎 Attachment: ${fileData.originalName})`
        : snippet;

      const notification = await Notification.create({
        type: 'contact',
        category: 'Contact & Support',
        title: notifTitle,
        message: notifMessage,
        unread: true,
        starred: false,
        link: '/softpicky-sn2026/settings?tab=notifications',
        linkText: 'View Inquiry',
        metadata: {
          inquiryId: inquiry._id,
          fullName: inquiry.fullName,
          email: inquiry.email,
          phone: inquiry.phone,
          hasAttachment: Boolean(fileData.url),
          fileUrl: fileData.url,
          fileName: fileData.originalName,
          fileMime: fileData.mimeType,
          fileSize: fileData.size,
        },
      });

      logger.info(`📩 New Contact Inquiry received: ID=${inquiry._id}, Name="${fullName}"`);

      return sendSuccess(
        res,
        {
          inquiry,
          notificationId: notification._id,
        },
        201,
        null,
        'Your message has been sent successfully! Our team will get back to you soon.'
      );
    } catch (err) {
      next(err);
    }
  },

  /**
   * List all contact inquiries for Admin
   */
  async list(req, res, next) {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const skip = (page - 1) * limit;

      const filter = {};
      if (req.query.status) {
        filter.status = req.query.status;
      }
      if (req.query.search) {
        const regex = new RegExp(req.query.search, 'i');
        filter.$or = [{ fullName: regex }, { email: regex }, { message: regex }];
      }

      const [inquiries, total] = await Promise.all([
        ContactInquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        ContactInquiry.countDocuments(filter),
      ]);

      const unreadCount = await ContactInquiry.countDocuments({ isRead: false });

      return sendSuccess(
        res,
        { inquiries, unreadCount },
        200,
        { page, limit, total, totalPages: Math.ceil(total / limit) }
      );
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get single inquiry by ID
   */
  async getById(req, res, next) {
    try {
      const inquiry = await ContactInquiry.findById(req.params.id);
      if (!inquiry) {
        return next(new AppError('Inquiry not found', 404));
      }
      return sendSuccess(res, inquiry);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Mark inquiry as read
   */
  async markAsRead(req, res, next) {
    try {
      const inquiry = await ContactInquiry.findByIdAndUpdate(
        req.params.id,
        { isRead: true, status: 'read' },
        { new: true }
      );
      if (!inquiry) {
        return next(new AppError('Inquiry not found', 404));
      }

      // Also mark corresponding notification as read if exists
      await Notification.updateMany(
        { 'metadata.inquiryId': req.params.id },
        { unread: false }
      );

      return sendSuccess(res, inquiry, 200, null, 'Inquiry marked as read');
    } catch (err) {
      next(err);
    }
  },

  /**
   * Download attachment file
   */
  async downloadFile(req, res, next) {
    try {
      const inquiry = await ContactInquiry.findById(req.params.id);
      if (!inquiry || !inquiry.file || !inquiry.file.filename) {
        return next(new AppError('Attachment not found for this inquiry', 404));
      }

      const filePath = path.join(__dirname, '../../../uploads/contact', inquiry.file.filename);
      if (!fs.existsSync(filePath)) {
        return next(new AppError('File does not exist on server disk', 404));
      }

      const originalName = inquiry.file.originalName || inquiry.file.filename;
      return res.download(filePath, originalName);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Delete inquiry
   */
  async delete(req, res, next) {
    try {
      const inquiry = await ContactInquiry.findByIdAndDelete(req.params.id);
      if (!inquiry) {
        return next(new AppError('Inquiry not found', 404));
      }

      // Delete file from disk if present
      if (inquiry.file && inquiry.file.filename) {
        const filePath = path.join(__dirname, '../../../uploads/contact', inquiry.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlink(filePath, () => {});
        }
      }

      // Remove corresponding notification
      await Notification.deleteMany({ 'metadata.inquiryId': req.params.id });

      return sendSuccess(res, null, 200, null, 'Inquiry deleted successfully');
    } catch (err) {
      next(err);
    }
  },
};

module.exports = ContactController;
