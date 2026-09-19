const express = require('express');
const { validateBody } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/reviewController');

const router = express.Router({ mergeParams: true });

router.get('/', ctrl.listReviews);
router.post('/', requireAuth, validateBody(ctrl.reviewSchema), ctrl.createReview);
router.delete('/:reviewId', requireAuth, ctrl.deleteReview);
router.patch('/:reviewId/hide', requireAuth, requireRole('admin'), ctrl.hideReview);

module.exports = router;
