const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const ctrl = require('../controllers/promoController');

const router = express.Router();

// Mijoz: savatdagi summaga promokodni sinab ko'rish
router.post('/check', requireAuth, ctrl.checkPromoCode);

// Admin va manager: to'liq boshqaruv
router.get('/', requireAuth, requireRole('admin', 'manager'), ctrl.listPromoCodes);
router.post('/', requireAuth, requireRole('admin', 'manager'), validateBody(ctrl.promoSchema), ctrl.createPromoCode);
router.put('/:id', requireAuth, requireRole('admin', 'manager'), validateBody(ctrl.promoSchema), ctrl.updatePromoCode);
router.delete('/:id', requireAuth, requireRole('admin', 'manager'), ctrl.deletePromoCode);

module.exports = router;
