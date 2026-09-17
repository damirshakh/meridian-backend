const express = require('express');
const { validateBody } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const questionCtrl = require('../controllers/questionController');
const bannerCtrl = require('../controllers/bannerController');
const staffCtrl = require('../controllers/staffController');
const auditCtrl = require('../controllers/auditController');
const { query } = require('../db/pool');

const router = express.Router();
// Bu yerdagi asosiy funksiyalar admin va manager uchun umumiy
router.use(requireAuth, requireRole('admin', 'manager'));

// Barcha mahsulotlar bo'yicha javobsiz savollar
router.get('/questions/unanswered', questionCtrl.listAllUnanswered);
router.patch('/questions/:questionId/answer', validateBody(questionCtrl.answerSchema), questionCtrl.answerQuestion);

// Bannerlar boshqaruvi
router.get('/banners', bannerCtrl.listAllBanners);
router.post('/banners', validateBody(bannerCtrl.bannerSchema), bannerCtrl.createBanner);
router.put('/banners/:id', validateBody(bannerCtrl.bannerSchema), bannerCtrl.updateBanner);
router.delete('/banners/:id', bannerCtrl.deleteBanner);

// So'nggi sharhlarni moderatsiya qilish uchun ro'yxat (yashiringan bo'lmaganlar)
router.get('/reviews/recent', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.full_name, p.name AS product_name, p.slug AS product_slug
       FROM product_reviews r
       JOIN users u ON u.id = r.user_id
       JOIN products p ON p.id = r.product_id
       WHERE r.is_hidden = FALSE
       ORDER BY r.created_at DESC
       LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.patch('/reviews/:reviewId/hide', async (req, res, next) => {
  try {
    await query('UPDATE product_reviews SET is_hidden = TRUE WHERE id = $1', [req.params.reviewId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Kam qolgan stok haqida ogohlantirish (threshold=5 dan kam bo'lsa)
router.get('/low-stock', async (req, res, next) => {
  try {
    const threshold = parseInt(req.query.threshold, 10) || 5;
    const result = await query(
      `SELECT pv.id AS variant_id, pv.sku, pv.size, pv.color, pv.stock_qty,
              p.id AS product_id, p.name AS product_name, p.slug AS product_slug
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       WHERE pv.stock_qty <= $1 AND p.is_published = TRUE
       ORDER BY pv.stock_qty ASC`,
      [threshold]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// --- Faqat 'admin' (super-admin) uchun: xodimlar va amallar tarixi ---
router.get('/staff', requireRole('admin'), staffCtrl.listStaff);
router.post('/staff', requireRole('admin'), validateBody(staffCtrl.createStaffSchema), staffCtrl.createStaff);
router.patch('/staff/:id/toggle-active', requireRole('admin'), staffCtrl.toggleStaffActive);
router.get('/audit-logs', requireRole('admin'), auditCtrl.listAuditLogs);

module.exports = router;
