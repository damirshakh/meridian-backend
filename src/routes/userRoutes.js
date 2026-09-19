const express = require('express');
const { validateBody } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/userController');

const router = express.Router();
router.use(requireAuth);

router.get('/me', ctrl.getMe);
router.patch('/me', validateBody(ctrl.updateProfileSchema), ctrl.updateProfile);
router.post('/me/change-password', validateBody(ctrl.changePasswordSchema), ctrl.changePassword);

module.exports = router;
