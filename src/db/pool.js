const { Pool } = require('pg');

// Bitta umumiy connection pool — har bir so'rov uchun yangi ulanish ochilmaydi.
// Bu ishlash tezligi va xavfsizlik (resurs tugab qolishining oldini olish) uchun muhim.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Productionda ko'p provayderlar (Railway/Render) SSL talab qiladi:
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  // Kutilmagan xatolik (masalan, uzilib qolgan client) — jarayonni yiqitmasdan log qilamiz
  console.error('Kutilmagan PostgreSQL pool xatoligi:', err);
});

/**
 * SQL so'rovini bajarish uchun yordamchi funksiya.
 * HAR DOIM parametrlashtirilgan so'rovlar ($1, $2...) ishlatiladi — SQL Injection'dan himoya.
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  if (process.env.NODE_ENV !== 'production') {
    const duration = Date.now() - start;
    console.log('SQL bajarildi', { text, duration, rows: res.rowCount });
  }
  return res;
}

/**
 * Tranzaksiya kerak bo'lganda (masalan, buyurtma yaratish + stokni kamaytirish)
 * shu funksiya orqali bitta client olinadi va COMMIT/ROLLBACK boshqariladi.
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
