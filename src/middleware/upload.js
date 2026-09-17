const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, '..', '..', 'uploads')),
  filename: (_req, file, cb) => {
    // Tasodifiy nom — foydalanuvchi kiritgan fayl nomiga ishonmaymiz (xavfsizlik)
    const randomName = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomName}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error('Faqat JPEG, PNG yoki WEBP formatidagi rasmlar qabul qilinadi'));
    }
    cb(null, true);
  },
});

module.exports = { upload };

// CSV import uchun — faylni diskka yozmasdan xotirada saqlaymiz (parse qilib bo'lgach kerak emas)
const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isCsv = file.mimetype === 'text/csv'
      || file.mimetype === 'application/vnd.ms-excel'
      || file.originalname.toLowerCase().endsWith('.csv');
    if (!isCsv) return cb(new Error('Faqat .csv fayl qabul qilinadi'));
    cb(null, true);
  },
});

module.exports.uploadCsv = uploadCsv;
