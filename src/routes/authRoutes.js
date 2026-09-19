const express = require('express');
const rateLimit = require('express-rate-limit');
const { validateBody } = require('../middleware/validate');
const ctrl = require('../controllers/authController');

const router = express.Router();

// Login/register uchun qattiqroq rate-limit — brute-force hujumlardan himoya
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 daqiqa
  max: 10,                  // shu vaqt ichida 10 ta urinish
  message: { error: 'Juda ko\'p urinish qilindi, biroz kuting va qayta urinib ko\'ring' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', authLimiter, validateBody(ctrl.registerSchema), ctrl.register);
router.post('/login', authLimiter, validateBody(ctrl.loginSchema), ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);

module.exports = router;
