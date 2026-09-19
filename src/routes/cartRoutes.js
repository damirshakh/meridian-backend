const express = require('express');
const { validateBody } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/cartController');

const router = express.Router();

router.use(requireAuth); // savat har doim tizimga kirgan foydalanuvchiga tegishli

router.get('/', ctrl.getCart);
router.post('/items', validateBody(ctrl.addItemSchema), ctrl.addItem);
router.patch('/items/:itemId', ctrl.updateItem);
router.delete('/items/:itemId', ctrl.removeItem);

module.exports = router;
