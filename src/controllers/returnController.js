const { z } = require('zod');
const { query } = require('../db/pool');
const { sendPushToUser } = require('./pushController');

const returnRequestSchema = z.object({
  type: z.enum(['return', 'exchange']),
  reason: z.string().min(5).max(1000),
});

async function createReturnRequest(req, res, next) {
  try {
    const { orderId } = req.params;
    const { type, reason } = req.body;

    // Faqat o'ziga tegishli va yetkazilgan buyurtma uchun so'rov berish mumkin
    const orderResult = await query('SELECT id, status FROM orders WHERE id = $1 AND user_id = $2', [orderId, req.user.id]);
    const order = orderResult.rows[0];
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    if (order.status !== 'delivered') {
      return res.status(400).json({ error: 'Faqat yetkazib berilgan buyurtmalar uchun so\'rov berish mumkin' });
    }

    const existing = await query(
      `SELECT id FROM return_requests WHERE order_id = $1 AND status = 'pending'`,
      [orderId]
    );
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Bu buyurtma uchun allaqachon ko\'rib chiqilayotgan so\'rov bor' });
    }

    const result = await query(
      `INSERT INTO return_requests (order_id, user_id, type, reason) VALUES ($1,$2,$3,$4) RETURNING *`,
      [orderId, req.user.id, type, reason]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function listMyReturnRequests(req, res, next) {
  try {
    const result = await query(
      `SELECT r.*, o.total FROM return_requests r JOIN orders o ON o.id = r.order_id
       WHERE r.user_id = $1 ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// --- Admin ---
async function listAllReturnRequests(req, res, next) {
  try {
    const status = req.query.status;
    const params = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE r.status = $${params.length}`;
    }
    const result = await query(
      `SELECT r.*, o.total, u.full_name AS customer_name
       FROM return_requests r
       JOIN orders o ON o.id = r.order_id
       JOIN users u ON u.id = r.user_id
       ${where}
       ORDER BY r.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

const statusUpdateSchema = z.object({
  status: z.enum(['approved', 'rejected', 'completed']),
  adminNote: z.string().max(1000).optional(),
});

async function updateReturnStatus(req, res, next) {
  try {
    const { requestId } = req.params;
    const { status, adminNote } = req.body;

    const result = await query(
      `UPDATE return_requests SET status = $1, admin_note = $2 WHERE id = $3
       RETURNING *`,
      [status, adminNote || null, requestId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'So\'rov topilmadi' });

    const STATUS_LABELS = { approved: 'tasdiqlandi', rejected: 'rad etildi', completed: 'yakunlandi' };
    await sendPushToUser(
      result.rows[0].user_id,
      'Qaytarish so\'rovi yangilandi',
      `So'rovingiz holati: ${STATUS_LABELS[status] || status}`
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createReturnRequest,
  listMyReturnRequests,
  listAllReturnRequests,
  updateReturnStatus,
  returnRequestSchema,
  statusUpdateSchema,
};
