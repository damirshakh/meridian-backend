const { query } = require('../db/pool');

async function listAuditLogs(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const result = await query(
      `SELECT a.id, a.action, a.entity, a.entity_id, a.meta, a.created_at, u.full_name AS actor_name, u.role AS actor_role
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.actor_id
       ORDER BY a.created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { listAuditLogs };
