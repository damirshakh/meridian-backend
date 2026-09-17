/**
 * Zod sxemasi orqali req.body ni tekshiradi. Xato bo'lsa 400 qaytaradi,
 * to'g'ri bo'lsa tozalangan (parsed) qiymatni req.body ga qo'yadi.
 */
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Ma\'lumotlar noto\'g\'ri',
        details: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data;
    next();
  };
}

/**
 * Global xatolik ushlagich — barcha route/controllerlardagi ushlanmagan
 * xatoliklar shu yerga tushadi. Foydalanuvchiga ichki tafsilotlar (stack trace,
 * SQL xabari) hech qachon ko'rsatilmaydi — bu xavfsizlik uchun muhim.
 */
function errorHandler(err, req, res, _next) {
  console.error('Xatolik:', err);

  if (err.code === '23505') {
    // PostgreSQL unique constraint
    return res.status(409).json({ error: 'Bu ma\'lumot allaqachon mavjud' });
  }
  if (err.code === '23503') {
    // foreign key violation
    return res.status(400).json({ error: 'Bog\'liq ma\'lumot topilmadi' });
  }

  res.status(err.status || 500).json({
    error: err.publicMessage || 'Serverda kutilmagan xatolik yuz berdi',
  });
}

module.exports = { validateBody, errorHandler };
