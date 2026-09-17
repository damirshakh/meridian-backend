const express = require('express');
const { validateBody } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadCsv } = require('../middleware/upload');
const ctrl = require('../controllers/productController');
const importCtrl = require('../controllers/importController');
const reviewRoutes = require('./reviewRoutes');
const questionRoutes = require('./questionRoutes');

const router = express.Router();

// --- Ochiq (mijozlar uchun) ---
router.get('/', ctrl.listProducts);
router.get('/categories', ctrl.listCategories);
router.get('/:slug', ctrl.getProductBySlug);
router.get('/:slug/similar', ctrl.getSimilarProducts);

// Sharh va savol-javob — productId talab qilinadi (slug emas, UUID)
router.use('/:productId/reviews', reviewRoutes);
router.use('/:productId/questions', questionRoutes);

// --- Admin va manager ---
router.post('/', requireAuth, requireRole('admin', 'manager'), validateBody(ctrl.productSchema), ctrl.createProduct);
router.put('/:id', requireAuth, requireRole('admin', 'manager'), validateBody(ctrl.productSchema), ctrl.updateProduct);
router.delete('/:id', requireAuth, requireRole('admin', 'manager'), ctrl.deleteProduct);

// Ommaviy import (CSV)
router.post('/import', requireAuth, requireRole('admin', 'manager'), (req, res, next) => {
  uploadCsv.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Fayl yuklashda xatolik' });
    importCtrl.importProducts(req, res, next);
  });
});

module.exports = router;
