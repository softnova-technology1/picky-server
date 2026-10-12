const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ContactController = require('./contact.controller');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../../uploads/contact');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Disk Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const randomHex = crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname);
    const cleanBaseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 30);
    const finalName = `${Date.now()}-${cleanBaseName}-${randomHex}${ext}`;
    cb(null, finalName);
  },
});

const fileFilter = (req, file, cb) => {
  // Allow common image and document formats
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];
  if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Please upload an image, PDF, or document.'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter,
});

// ── Public Endpoint: Submit Contact Message & File
router.post('/', upload.single('file'), ContactController.submit);

// ── Admin Endpoints
router.get('/', ContactController.list);
router.get('/:id', ContactController.getById);
router.patch('/:id/read', ContactController.markAsRead);
router.get('/download/:id', ContactController.downloadFile);
router.delete('/:id', ContactController.delete);

module.exports = router;
