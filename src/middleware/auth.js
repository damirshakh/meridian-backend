const { verifyAccessToken } = require('../utils/auth');

/**
 * So'rov headeridagi "Authorization: Bearer <token>" ni tekshiradi.
 * To'g'ri bo'lsa req.user = { id, role } qo'yiladi.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token yaroqsiz yoki muddati tugagan' });
  }
}

/**
 * Faqat berilgan rollarga ruxsat beradi. requireAuth dan KEYIN ishlatiladi.
 * Masalan: requireRole('admin')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bu amal uchun ruxsatingiz yo\'q' });
    }
    next();
  };
}

/**
 * Token bo'lsa foydalanuvchini aniqlaydi, bo'lmasa ham so'rovni to'xtatmaydi.
 * (Masalan: mahsulot sahifasi mehmon uchun ham, tizimga kirgan uchun ham ochiq,
 * lekin kirgan bo'lsa sevimlilar holatini ko'rsatish uchun foydali)
 */
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      // jim o'tkazamiz — mehmon sifatida davom etadi
    }
  }
  next();
}

module.exports = { requireAuth, requireRole, optionalAuth };
