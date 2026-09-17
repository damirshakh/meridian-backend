require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const addressRoutes = require('./routes/addressRoutes');
const adminRoutes = require('./routes/adminRoutes');
const homeRoutes = require('./routes/homeRoutes');
const promoRoutes = require('./routes/promoRoutes');
const pushRoutes = require('./routes/pushRoutes');
const userRoutes = require('./routes/userRoutes');
const { errorHandler } = require('./middleware/validate');

const app = express();

// Render/Railway kabi proksi orqasida ishlaganda IP va HTTPS to'g'ri aniqlansin
app.set('trust proxy', 1);

// --- Xavfsizlik: HTTP headerlar ---
// crossOriginResourcePolicy: 'cross-origin' — bu ATAYLAB shunday: mahsulot/banner rasmlari
// boshqa portdan (masalan mobil ilova 8081, admin panel 5173) ochilishi kerak.
// Helmet'ning standart 'same-origin' siyosati buni bloklab, rasmlar hech qayerda
// ko'rinmay qolishiga sabab bo'lardi (aynan shu xato kuzatilgan edi).
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// --- CORS: faqat ruxsat etilgan manzillardan so'rovlarga yo'l beriladi ---
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      // Mobil ilova (Expo) ba'zan Origin header yubormaydi — shuni ham ruxsat beramiz
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('CORS: ruxsat etilmagan manzil'));
    },
    credentials: true, // HttpOnly cookie (refresh token) yuborilishi uchun shart
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// Yuklangan rasmlarni ochiq qilib beramiz (masalan /uploads/abc123.jpg)
app.use('/uploads', express.static(require('path').join(__dirname, '..', 'uploads')));

// --- Umumiy so'rov chegarasi (DDoS/spam'dan asosiy himoya) ---
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/promo', promoRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Noma'lum route
app.use('/api', (_req, res) => res.status(404).json({ error: 'Manzil topilmadi' }));

app.use(errorHandler);

module.exports = app;
