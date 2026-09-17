const { z } = require('zod');
const { query } = require('../db/pool');
const { hashPassword, verifyPassword } = require('../utils/auth');

async function getMe(req, res, next) {
  try {
    const result = await query(
      `SELECT id, full_name, email, phone, role, language, notifications_enabled, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    res.json(toPublicProfile(result.rows[0]));
  } catch (err) {
    next(err);
  }
}

const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(150).optional(),
  phone: z.string().min(9).max(20).optional(),
  language: z.enum(['uz', 'ru', 'en']).optional(),
  notificationsEnabled: z.boolean().optional(),
});

async function updateProfile(req, res, next) {
  try {
    const d = req.body;
    const current = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const u = current.rows[0];

    const result = await query(
      `UPDATE users SET full_name=$1, phone=$2, language=$3, notifications_enabled=$4
       WHERE id=$5
       RETURNING id, full_name, email, phone, role, language, notifications_enabled, created_at`,
      [
        d.fullName ?? u.full_name,
        d.phone ?? u.phone,
        d.language ?? u.language,
        d.notificationsEnabled ?? u.notifications_enabled,
        req.user.id,
      ]
    );
    res.json(toPublicProfile(result.rows[0]));
  } catch (err) {
    next(err);
  }
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, 'Parol kamida 8 belgidan iborat bo\'lishi kerak')
    .regex(/[A-Z]/, 'Parolda kamida 1 ta katta harf bo\'lishi kerak')
    .regex(/[0-9]/, 'Parolda kamida 1 ta raqam bo\'lishi kerak'),
});

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await verifyPassword(currentPassword, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Joriy parol noto\'g\'ri' });

    const newHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

function toPublicProfile(u) {
  return {
    id: u.id,
    fullName: u.full_name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    language: u.language,
    notificationsEnabled: u.notifications_enabled,
  };
}

module.exports = { getMe, updateProfile, changePassword, updateProfileSchema, changePasswordSchema };
