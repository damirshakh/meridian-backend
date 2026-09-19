// db/migrations/ papkasidagi .sql fayllarni tartib bilan, FAQAT hali qo'llanilmaganlarini bazaga qo'llaydi.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Qaysi migratsiyalar allaqachon qo'llanilganini kuzatib boruvchi jadval
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const appliedResult = await pool.query('SELECT filename FROM schema_migrations');
  const applied = new Set(appliedResult.rows.map((r) => r.filename));

  // Agar kuzatuv jadvali bo'sh bo'lsa-yu, lekin 'users' jadvali allaqachon mavjud bo'lsa —
  // demak boshlang'ich migratsiya eski usulda (kuzatuvsiz) qo'llangan. Uni "bajarilgan" deb belgilaymiz,
  // aks holda "already exists" xatoligi chiqadi.
  if (applied.size === 0) {
    const usersExists = await pool.query("SELECT to_regclass('public.users') AS exists");
    if (usersExists.rows[0].exists) {
      await pool.query(
        `INSERT INTO schema_migrations (filename) VALUES ('001_init.sql') ON CONFLICT DO NOTHING`
      );
      applied.add('001_init.sql');
      console.log('-> Aniqlandi: baza allaqachon boshlang\'ich sxema bilan mavjud, 001_init.sql belgilandi');
    }
  }

  const dir = path.join(__dirname, '..', 'db', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  let appliedCount = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`-> O'tkazib yuborildi (allaqachon qo'llangan): ${file}`);
      continue;
    }
    console.log(`-> Bajarilmoqda: ${file}`);
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await pool.query(sql);
    await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    appliedCount++;
  }

  console.log(`✅ Tugadi. Yangi qo'llangan migratsiyalar: ${appliedCount}`);
  await pool.end();
}

main().catch((err) => {
  console.error('❌ Migratsiya xatoligi:', err.message);
  process.exit(1);
});
