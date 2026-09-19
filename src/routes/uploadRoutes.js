const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

function buildUrl(req, filename) {
  // PUBLIC_BASE_URL .env'da berilgan bo'lsa shuni ishlatamiz — bu MUHIM:
  // "localhost" faqat o'sha kompyuterning o'zida ishlaydi, telefon yoki boshqa
  // qurilmadan ochilganda rasm ko'rinmay qoladi. Productionda bu doim to'liq
  // domen (masalan https://api.sizningsayt.com) bo'lishi kerak.
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${base.replace(/\/$/, '')}/uploads/${filename}`;
}

// Bitta rasm (orqaga moslik uchun saqlanadi)
router.post('/image', requireAuth, requireRole('admin', 'manager'), (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Rasm yuklashda xatolik' });
    if (!req.file) return res.status(400).json({ error: 'Rasm tanlanmadi' });
    res.status(201).json({ url: buildUrl(req, req.file.filename) });
  });
});

// Bir nechta rasm (mahsulotga galereya qo'shish uchun) — bir so'rovda 8 tagacha
router.post('/images', requireAuth, requireRole('admin', 'manager'), (req, res) => {
  upload.array('images', 8)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Rasm yuklashda xatolik' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Rasm tanlanmadi' });
    const urls = req.files.map((f) => buildUrl(req, f.filename));
    res.status(201).json({ urls });
  });
});

module.exports = router;
