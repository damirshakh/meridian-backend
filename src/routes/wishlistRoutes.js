const express = require('express');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/wishlistController');

const router = express.Router();
router.use(requireAuth);

router.get('/', ctrl.listWishlist);
router.get('/:productId/check', ctrl.checkWishlist);
router.post('/:productId', ctrl.addToWishlist);
router.delete('/:productId', ctrl.removeFromWishlist);

module.exports = router;
