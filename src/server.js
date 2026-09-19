require('dotenv').config();
const app = require('./app');
const { pool } = require('./db/pool');

const PORT = process.env.PORT || 4000;

// Ishga tushishdan oldin bazaga ulanishni tekshiramiz — muammoni darhol ko'ramiz
pool
  .query('SELECT 1')
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Meridian backend http://localhost:${PORT} portida ishga tushdi`);
    });
  })
  .catch((err) => {
    console.error('❌ PostgreSQL bazasiga ulanib bo\'lmadi:', err.message);
    console.error('DATABASE_URL to\'g\'ri sozlanganini tekshiring (.env fayl)');
    process.exit(1);
  });

// Kutilmagan xatoliklarni jim yutib yubormaslik uchun
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
