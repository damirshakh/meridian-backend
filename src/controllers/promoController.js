const { z } = require('zod');
const { query } = require('../db/pool');

const promoSchema = z.object({
  code: z.string().min(3).max(50).transform((v) => v.toUpperCase()),
  discountType: z.enum(['percent', 'fixed']),
  discountValue: z.number().positive(),
  minOrderAmount: z.number().nonnegative().default(0),
  maxUses: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
  expiresAt: z.string().optional(), // ISO sana
});

// Promokodni tekshirish va chegirma summasini hisoblash — buyurtma yaratishdan oldin ham,
// savat sahifasida "qo'llash" bosilganda ham ishlatiladi.
async function validatePromoCode(code, subtotal, client = null) {
  const runner = client || { query };
  const result = await runner.query(
    'SELECT * FROM promo_codes WHERE code = $1',
    [code.toUpperCase()]
  );
  const promo = result.rows[0];

  if (!promo) return { valid: false, error: 'Promokod topilmadi' };
  if (!promo.is_active) return { valid: false, error: 'Bu promokod faol emas' };
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return { valid: false, error: 'Promokod muddati tugagan' };
  }
  if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
    return { valid: false, error: 'Promokod limiti tugagan' };
  }
  if (Number(subtotal) < Number(promo.min_order_amount)) {
    return {
      valid: false,
      error: `Bu promokod kamida ${Number(promo.min_order_amount).toLocaleString('ru-RU')} сом buyurtma uchun amal qiladi`,
    };
  }

  const discountAmount = promo.discount_type === 'percent'
    ? (Number(subtotal) * Number(promo.discount_value)) / 100
    : Number(promo.discount_value);

  return {
    valid: true,
    promo,
    discountAmount: Math.min(discountAmount, Number(subtotal)), // chegirma summadan oshib ketmasin
  };
}

// Mijoz uchun: savatdagi summaga promokodni sinab ko'rish (hali buyurtma bermasdan)
async function checkPromoCode(req, res, next) {
  try {
    const { code, subtotal } = req.body;
    if (!code || subtotal === undefined) {
      return res.status(400).json({ error: 'Kod va summa kerak' });
    }
    const result = await validatePromoCode(code, subtotal);
    if (!result.valid) return res.status(400).json({ error: result.error });

    res.json({
      valid: true,
      discountAmount: result.discountAmount,
      discountType: result.promo.discount_type,
      discountValue: result.promo.discount_value,
    });
  } catch (err) {
    next(err);
  }
}

// --- Admin: promokodlar CRUD ---
async function listPromoCodes(_req, res, next) {
  try {
    const result = await query('SELECT * FROM promo_codes ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

async function createPromoCode(req, res, next) {
  try {
    const d = req.body;
    const result = await query(
      `INSERT INTO promo_codes (code, discount_type, discount_value, min_order_amount, max_uses, is_active, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [d.code, d.discountType, d.discountValue, d.minOrderAmount, d.maxUses || null, d.isActive, d.expiresAt || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function updatePromoCode(req, res, next) {
  try {
    const d = req.body;
    const result = await query(
      `UPDATE promo_codes SET code=$1, discount_type=$2, discount_value=$3, min_order_amount=$4,
        max_uses=$5, is_active=$6, expires_at=$7
       WHERE id=$8 RETURNING *`,
      [d.code, d.discountType, d.discountValue, d.minOrderAmount, d.maxUses || null, d.isActive, d.expiresAt || null, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Promokod topilmadi' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function deletePromoCode(req, res, next) {
  try {
    await query('DELETE FROM promo_codes WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  validatePromoCode,
  checkPromoCode,
  listPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  promoSchema,
};
