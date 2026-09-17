const express = require('express');
const { validateBody } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/pushController');

const router = express.Router();
router.use(requireAuth);

router.post('/register', validateBody(ctrl.registerTokenSchema), ctrl.registerPushToken);
router.post('/unregister', ctrl.unregisterPushToken);

module.exports = router;
