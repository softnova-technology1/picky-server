const express = require('express');
const router = express.Router();
const multer = require('multer');
const ContactController = require('./contact.controller');

// Allowed image and document formats (up to 15MB)
const fileFilter = (req, file, cb) => {
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

// Memory storage for direct AWS S3 streaming upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter,
});

// ── Public Endpoint: Directly upload reference file to S3 bucket (picky/inquiries)
router.post('/upload', upload.single('file'), ContactController.uploadFile);

// ── Public Endpoint: Submit Contact Message & Reference File
router.post('/', upload.single('file'), ContactController.submit);

// ── Admin Endpoints (Batch operations placed before /:id routes)
router.get('/', ContactController.list);
router.post('/bulk-delete', ContactController.bulkDelete);
router.patch('/bulk-read', ContactController.bulkRead);
router.patch('/mark-all-read', ContactController.markAllRead);
router.get('/:id', ContactController.getById);
router.patch('/:id/read', ContactController.markAsRead);
router.get('/download/:id', ContactController.downloadFile);
router.delete('/:id', ContactController.delete);

module.exports = router;
