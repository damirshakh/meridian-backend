const { z } = require('zod');
const { query } = require('../db/pool');

const registerTokenSchema = z.object({
  token: z.string().min(10).max(255),
});

async function registerPushToken(req, res, next) {
  try {
    const { token } = req.body;
    await query(
      `INSERT INTO push_tokens (user_id, token) VALUES ($1, $2)
       ON CONFLICT (token) DO UPDATE SET user_id = $1`,
      [req.user.id, token]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function unregisterPushToken(req, res, next) {
  try {
    await query('DELETE FROM push_tokens WHERE token = $1', [req.body.token]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * Foydalanuvchining barcha qurilmalariga push-bildirishnoma yuboradi (Expo Push API orqali).
 * Xatolik bo'lsa ham asosiy amal (masalan buyurtma statusini o'zgartirish) to'xtamasligi uchun
 * xatoliklarni faqat log qilamiz, exception otmaymiz.
 */
async function sendPushToUser(userId, title, body, data = {}) {
  try {
    const tokens = await query('SELECT token FROM push_tokens WHERE user_id = $1', [userId]);
    if (tokens.rowCount === 0) return;

    const messages = tokens.rows.map((t) => ({
      to: t.token,
      sound: 'default',
      title,
      body,
      data,
    }));

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.error('Push-bildirishnoma yuborishda xatolik (asosiy amalga ta\'sir qilmaydi):', err.message);
  }
}

module.exports = { registerPushToken, unregisterPushToken, sendPushToUser, registerTokenSchema };
