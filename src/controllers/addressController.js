const { z } = require('zod');
const { query, withTransaction } = require('../db/pool');

const addressSchema = z.object({
  label: z.string().max(50).optional(),
  city: z.string().min(2).max(100),
  line1: z.string().min(3).max(255),
  line2: z.string().max(255).optional(),
  phone: z.string().min(9).max(20).optional(),
  isDefault: z.boolean().optional().default(false),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

async function listAddresses(req, res, next) {
  try {
    const result = await query(
      'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

async function createAddress(req, res, next) {
  try {
    const data = req.body;
    const address = await withTransaction(async (client) => {
      if (data.isDefault) {
        await client.query('UPDATE addresses SET is_default = FALSE WHERE user_id = $1', [req.user.id]);
      }
      const result = await client.query(
        `INSERT INTO addresses (user_id, label, city, line1, line2, phone, is_default, latitude, longitude)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          req.user.id, data.label || null, data.city, data.line1, data.line2 || null,
          data.phone || null, data.isDefault, data.latitude ?? null, data.longitude ?? null,
        ]
      );
      return result.rows[0];
    });
    res.status(201).json(address);
  } catch (err) {
    next(err);
  }
}

async function updateAddress(req, res, next) {
  try {
    const data = req.body;
    const address = await withTransaction(async (client) => {
      if (data.isDefault) {
        await client.query('UPDATE addresses SET is_default = FALSE WHERE user_id = $1', [req.user.id]);
      }
      const result = await client.query(
        `UPDATE addresses SET label=$1, city=$2, line1=$3, line2=$4, phone=$5, is_default=$6, latitude=$7, longitude=$8
         WHERE id=$9 AND user_id=$10 RETURNING *`,
        [
          data.label || null, data.city, data.line1, data.line2 || null, data.phone || null,
          data.isDefault, data.latitude ?? null, data.longitude ?? null, req.params.id, req.user.id,
        ]
      );
      if (result.rowCount === 0) {
        const err = new Error('Manzil topilmadi');
        err.status = 404;
        throw err;
      }
      return result.rows[0];
    });
    res.json(address);
  } catch (err) {
    next(err);
  }
}

async function deleteAddress(req, res, next) {
  try {
    const result = await query('DELETE FROM addresses WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Manzil topilmadi' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listAddresses, createAddress, updateAddress, deleteAddress, addressSchema };
