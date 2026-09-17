const { z } = require('zod');
const { query } = require('../db/pool');
const { hashPassword } = require('../utils/auth');

const createStaffSchema = z.object({
  fullName: z.string().min(2).max(150),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Parolda kamida 1 ta katta harf bo\'lishi kerak')
    .regex(/[0-9]/, 'Parolda kamida 1 ta raqam bo\'lishi kerak'),
  role: z.enum(['admin', 'manager']),
});

async function listStaff(_req, res, next) {
  try {
    const result = await query(
      `SELECT id, full_name, email, role, is_active, created_at
       FROM users WHERE role IN ('admin', 'manager') ORDER BY created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

async function createStaff(req, res, next) {
  try {
    const { fullName, email, password, role } = req.body;

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Bu email bilan foydalanuvchi allaqachon mavjud' });
    }

    const passwordHash = await hashPassword(password);
    const result = await query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1,$2,$3,$4) RETURNING id, full_name, email, role, is_active, created_at`,
      [fullName, email, passwordHash, role]
    );

    await query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, meta)
       VALUES ($1,'staff.create','user',$2,$3)`,
      [req.user.id, result.rows[0].id, JSON.stringify({ email, role })]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function toggleStaffActive(req, res, next) {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ error: 'O\'zingizni bloklay olmaysiz' });
    }
    const result = await query(
      `UPDATE users SET is_active = NOT is_active WHERE id = $1 AND role IN ('admin','manager')
       RETURNING id, is_active`,
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Xodim topilmadi' });

    await query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, meta)
       VALUES ($1,'staff.toggle_active','user',$2,$3)`,
      [req.user.id, id, JSON.stringify({ isActive: result.rows[0].is_active })]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = { listStaff, createStaff, toggleStaffActive, createStaffSchema };
