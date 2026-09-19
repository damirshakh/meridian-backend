const express = require('express');
const { validateBody } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/categoryController');

const router = express.Router();

router.get('/', ctrl.listCategories);
router.post('/', requireAuth, requireRole('admin', 'manager'), validateBody(ctrl.categorySchema), ctrl.createCategory);
router.put('/:id', requireAuth, requireRole('admin', 'manager'), validateBody(ctrl.categorySchema), ctrl.updateCategory);
router.delete('/:id', requireAuth, requireRole('admin', 'manager'), ctrl.deleteCategory);

module.exports = router;
