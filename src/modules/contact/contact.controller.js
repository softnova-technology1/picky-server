const path = require('path');
const fs = require('fs');
const ContactInquiry = require('../../models/contact.model');
const Notification = require('../../models/notification.model');
const { uploadFile, deleteImage } = require('../../services/s3.service');
const { sendSuccess, sendError } = require('../../utils/apiResponse');
const AppError = require('../../utils/appError');
const logger = require('../../utils/logger');

const ContactController = {
  /**
   * Directly Upload Reference File to S3 Bucket (picky/inquiries)
   * Public endpoint used before/during contact form submission
   */
  async uploadFile(req, res, next) {
    try {
      if (!req.file || !req.file.buffer) {
        return next(new AppError('No file provided for upload', 400));
      }

      const { url, key } = await uploadFile(
        req.file.buffer,
        'inquiries',
        req.file.originalname,
        req.file.mimetype
      );

      logger.info(`📎 Contact reference file uploaded to S3: ${url} (Key: ${key})`);

      return sendSuccess(
        res,
        {
          url,
          key,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
        },
        200,
        null,
        'File uploaded to S3 successfully'
      );
    } catch (err) {
      next(err);
    }
  },

  /**
   * Submit Contact Form (Public Endpoint)
   * Supports pre-uploaded S3 URL or direct multipart file upload
   * Supports source: 'contact_page' | 'homepage' | 'footer'
   */
  async submit(req, res, next) {
    try {
      const { fullName, email, phone, message, source } = req.body;

      if (!fullName || !fullName.trim()) {
        return next(new AppError('Full name is required', 400));
      }
      if (!message || !message.trim()) {
        return next(new AppError('Message is required', 400));
      }

      let fileData = {
        url: '',
        key: '',
        originalName: '',
        mimeType: '',
        size: 0,
        filename: '',
      };

      // Case 1: File pre-uploaded to S3 (passed via body)
      if (req.body.fileUrl) {
        fileData = {
          url: req.body.fileUrl,
          key: req.body.fileKey || req.body.key || '',
          originalName: req.body.fileName || req.body.originalName || 'Attachment',
          mimeType: req.body.fileMime || req.body.mimeType || '',
          size: Number(req.body.fileSize || req.body.size || 0),
          filename: req.body.fileName || req.body.originalName || '',
        };
      } else if (req.body.file && typeof req.body.file === 'object') {
        fileData = {
          url: req.body.file.url || '',
          key: req.body.file.key || '',
          originalName: req.body.file.originalName || '',
          mimeType: req.body.file.mimeType || '',
          size: Number(req.body.file.size || 0),
          filename: req.body.file.filename || req.body.file.originalName || '',
        };
      } else if (typeof req.body.file === 'string' && req.body.file.startsWith('http')) {
        fileData.url = req.body.file;
        fileData.originalName = req.body.originalName || 'Attachment';
      }

      // Case 2: File uploaded directly in multipart form (req.file)
      if (req.file && req.file.buffer) {
        const uploadResult = await uploadFile(
          req.file.buffer,
          'inquiries',
          req.file.originalname,
          req.file.mimetype
        );
        fileData = {
          url: uploadResult.url,
          key: uploadResult.key,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          filename: path.basename(uploadResult.key),
        };
      }

      const cleanSource = ['contact_page', 'homepage', 'footer', 'general'].includes(source)
        ? source
        : 'contact_page';

      // 1. Create Contact Inquiry in MongoDB
      const inquiry = await ContactInquiry.create({
        fullName: fullName.trim(),
        email: email ? email.trim() : '',
        phone: phone ? phone.trim() : '',
        message: message.trim(),
        file: fileData,
        isRead: false,
        status: 'unread',
        source: cleanSource,
      });

      // 2. Create In-App Admin Notification in MongoDB
      const snippet = message.trim().length > 90 ? `${message.trim().slice(0, 90)}...` : message.trim();
      const sourceLabel = cleanSource === 'homepage' || cleanSource === 'footer' ? 'Homepage' : 'Contact Page';
      const notifTitle = `New Inquiry from ${fullName.trim()} (${sourceLabel})`;
      const notifMessage = fileData.url
        ? `${snippet} (📎 Attachment: ${fileData.originalName})`
        : snippet;

      const notification = await Notification.create({
        type: 'contact',
        category: 'Contact & Support',
        title: notifTitle,
        subtitle: `${sourceLabel} Submission`,
        message: notifMessage,
        unread: true,
        starred: false,
        link: '/softpicky-sn2026/notifications',
        linkText: 'View Inquiry',
        metadata: {
          inquiryId: inquiry._id,
          fullName: inquiry.fullName,
          email: inquiry.email,
          phone: inquiry.phone,
          source: cleanSource,
          hasAttachment: Boolean(fileData.url),
          fileUrl: fileData.url,
          fileKey: fileData.key,
          fileName: fileData.originalName,
          fileMime: fileData.mimeType,
          fileSize: fileData.size,
        },
      });

      logger.info(`📩 New Contact Inquiry received: ID=${inquiry._id}, Source=${cleanSource}, Name="${fullName}", Attachment=${fileData.url || 'None'}`);

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
   * List all contact inquiries for Admin with source & search filtering
   */
  async list(req, res, next) {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const skip = (page - 1) * limit;

      const filter = {};

      // Source filter: 'all' | 'contact_page' | 'homepage'
      if (req.query.source && req.query.source !== 'all') {
        if (req.query.source === 'homepage') {
          filter.source = { $in: ['homepage', 'footer'] };
        } else if (req.query.source === 'contact_page') {
          // If inquiry has no source field, treat as legacy contact_page
          filter.$or = [{ source: 'contact_page' }, { source: { $exists: false } }, { source: null }];
        } else {
          filter.source = req.query.source;
        }
      }

      // Status / Read filter: 'all' | 'unread' | 'read'
      if (req.query.status) {
        if (req.query.status === 'unread') {
          filter.isRead = false;
        } else if (req.query.status === 'read') {
          filter.isRead = true;
        } else if (['unread', 'read', 'replied'].includes(req.query.status)) {
          filter.status = req.query.status;
        }
      }

      // Search term
      if (req.query.search && req.query.search.trim()) {
        const regex = new RegExp(req.query.search.trim(), 'i');
        const searchConditions = [{ fullName: regex }, { email: regex }, { phone: regex }, { message: regex }];
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
          delete filter.$or;
        } else {
          filter.$or = searchConditions;
        }
      }

      const [inquiries, total, unreadCount, contactCount, homepageCount] = await Promise.all([
        ContactInquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        ContactInquiry.countDocuments(filter),
        ContactInquiry.countDocuments({ isRead: false }),
        ContactInquiry.countDocuments({
          $or: [{ source: 'contact_page' }, { source: { $exists: false } }, { source: null }],
        }),
        ContactInquiry.countDocuments({ source: { $in: ['homepage', 'footer'] } }),
      ]);

      return sendSuccess(
        res,
        {
          inquiries,
          unreadCount,
          contactCount,
          homepageCount,
          totalInquiries: await ContactInquiry.countDocuments(),
        },
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
   * Mark inquiry as read or toggle status
   */
  async markAsRead(req, res, next) {
    try {
      const isRead = req.body.isRead !== undefined ? Boolean(req.body.isRead) : true;
      const status = isRead ? 'read' : 'unread';

      const inquiry = await ContactInquiry.findByIdAndUpdate(
        req.params.id,
        { isRead, status },
        { new: true }
      );
      if (!inquiry) {
        return next(new AppError('Inquiry not found', 404));
      }

      // Update corresponding notification
      await Notification.updateMany(
        { 'metadata.inquiryId': req.params.id },
        { unread: !isRead }
      );

      return sendSuccess(res, inquiry, 200, null, `Inquiry marked as ${status}`);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Bulk Mark Inquiries as Read or Unread
   */
  async bulkRead(req, res, next) {
    try {
      const { ids, isRead = true } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return next(new AppError('No inquiry IDs provided', 400));
      }

      const status = isRead ? 'read' : 'unread';
      await ContactInquiry.updateMany(
        { _id: { $in: ids } },
        { isRead: Boolean(isRead), status }
      );

      await Notification.updateMany(
        { 'metadata.inquiryId': { $in: ids } },
        { unread: !isRead }
      );

      return sendSuccess(res, { updatedCount: ids.length }, 200, null, `Selected inquiries marked as ${status}`);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Mark all inquiries as read
   */
  async markAllRead(req, res, next) {
    try {
      await ContactInquiry.updateMany({ isRead: false }, { isRead: true, status: 'read' });
      await Notification.updateMany({ type: 'contact', unread: true }, { unread: false });
      return sendSuccess(res, null, 200, null, 'All inquiries marked as read');
    } catch (err) {
      next(err);
    }
  },

  /**
   * Download or view attachment file (Redirects to S3 or serves local file)
   */
  async downloadFile(req, res, next) {
    try {
      const inquiry = await ContactInquiry.findById(req.params.id);
      if (!inquiry || !inquiry.file || (!inquiry.file.url && !inquiry.file.filename)) {
        return next(new AppError('Attachment not found for this inquiry', 404));
      }

      if (inquiry.file.url && inquiry.file.url.startsWith('http')) {
        return res.redirect(inquiry.file.url);
      }

      const filePath = path.join(__dirname, '../../../uploads/inquiries', inquiry.file.filename || '');
      if (fs.existsSync(filePath)) {
        const originalName = inquiry.file.originalName || inquiry.file.filename;
        return res.download(filePath, originalName);
      }

      return next(new AppError('File does not exist on server disk', 404));
    } catch (err) {
      next(err);
    }
  },

  /**
   * Delete inquiry and its S3 reference asset
   */
  async delete(req, res, next) {
    try {
      const inquiry = await ContactInquiry.findByIdAndDelete(req.params.id);
      if (!inquiry) {
        return next(new AppError('Inquiry not found', 404));
      }

      // Delete file from S3 / disk if present
      if (inquiry.file && (inquiry.file.key || inquiry.file.url)) {
        await deleteImage(inquiry.file.key || inquiry.file.url).catch(() => {});
      }

      // Remove corresponding notification
      await Notification.deleteMany({ 'metadata.inquiryId': req.params.id });

      return sendSuccess(res, null, 200, null, 'Inquiry deleted successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * Bulk Delete Inquiries and associated S3 files
   */
  async bulkDelete(req, res, next) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return next(new AppError('No inquiry IDs provided', 400));
      }

      const inquiries = await ContactInquiry.find({ _id: { $in: ids } });
      for (const inq of inquiries) {
        if (inq.file && (inq.file.key || inq.file.url)) {
          await deleteImage(inq.file.key || inq.file.url).catch(() => {});
        }
      }

      await ContactInquiry.deleteMany({ _id: { $in: ids } });
      await Notification.deleteMany({ 'metadata.inquiryId': { $in: ids } });

      return sendSuccess(res, { deletedCount: inquiries.length }, 200, null, 'Selected inquiries deleted successfully');
    } catch (err) {
      next(err);
    }
  },
};

module.exports = ContactController;
