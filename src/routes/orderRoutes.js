const express = require('express');
const { validateBody } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/orderController');
const returnCtrl = require('../controllers/returnController');

const router = express.Router();

router.use(requireAuth);

router.post('/', validateBody(ctrl.createOrderSchema), ctrl.createOrder);
router.get('/my', ctrl.listMyOrders);
router.get('/my/returns', returnCtrl.listMyReturnRequests);
router.get('/my/:id', ctrl.getMyOrder);
router.post('/:orderId/return-request', validateBody(returnCtrl.returnRequestSchema), returnCtrl.createReturnRequest);
router.post('/:id/reorder', ctrl.reorderItems);

// --- Admin va manager ---
router.get('/', requireRole('admin', 'manager'), ctrl.listAllOrders);
router.patch('/:id/status', requireRole('admin', 'manager'), validateBody(ctrl.statusSchema), ctrl.updateOrderStatus);
router.get('/returns/all', requireRole('admin', 'manager'), returnCtrl.listAllReturnRequests);
router.patch('/returns/:requestId/status', requireRole('admin', 'manager'), validateBody(returnCtrl.statusUpdateSchema), returnCtrl.updateReturnStatus);

module.exports = router;
