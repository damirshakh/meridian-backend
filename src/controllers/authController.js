const { z } = require('zod');
const { query } = require('../db/pool');
const {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} = require('../utils/auth');

const registerSchema = z.object({
  fullName: z.string().min(2, 'Ism kamida 2 belgidan iborat bo\'lishi kerak').max(150),
  email: z.string().email('Email noto\'g\'ri formatda'),
  phone: z.string().min(9).max(20).optional(),
  password: z
    .string()
    .min(8, 'Parol kamida 8 belgidan iborat bo\'lishi kerak')
    .regex(/[A-Z]/, 'Parolda kamida 1 ta katta harf bo\'lishi kerak')
    .regex(/[0-9]/, 'Parolda kamida 1 ta raqam bo\'lishi kerak'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,        // JS orqali o'qib bo'lmaydi -> XSS'dan himoya
  secure: process.env.NODE_ENV === 'production', // productionda faqat HTTPS
  sameSite: 'lax',       // CSRF xavfini kamaytiradi
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 kun
  path: '/api/auth',
};

async function register(req, res, next) {
  try {
    const { fullName, email, phone, password } = req.body;

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Bu email bilan foydalanuvchi allaqachon mavjud' });
    }

    const passwordHash = await hashPassword(password);
    const result = await query(
      `INSERT INTO users (full_name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role, created_at`,
      [fullName, email, phone || null, passwordHash]
    );
    const user = result.rows[0];

    // Har bir foydalanuvchiga bo'sh savat ochamiz
    await query('INSERT INTO carts (user_id) VALUES ($1)', [user.id]);

    const accessToken = await issueTokens(res, user);
    res.status(201).json({ user: publicUser(user), accessToken });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const result = await query(
      'SELECT id, full_name, email, role, password_hash, is_active FROM users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];

    // Xavfsizlik: email topilmasa ham, parol xato bo'lsa ham BIR XIL xabar
    // qaytariladi — bu orqali "qaysi email mavjud" degan ma'lumot sizib chiqmaydi
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri' });
    }

    const accessToken = await issueTokens(res, user);
    res.json({ user: publicUser(user), accessToken });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ error: 'Refresh token topilmadi' });

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      return res.status(401).json({ error: 'Refresh token yaroqsiz' });
    }

    const tokenHash = hashToken(token);
    const stored = await query(
      `SELECT rt.id, rt.revoked, rt.expires_at, u.id as user_id, u.role, u.full_name, u.email
       FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1`,
      [tokenHash]
    );
    const row = stored.rows[0];

    if (!row || row.revoked || new Date(row.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Sessiya tugagan, qaytadan kiring' });
    }

    // Token rotatsiyasi: eskisini bekor qilib, yangisini beramiz
    await query('UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1', [row.id]);
    const user = { id: row.user_id, role: row.role, full_name: row.full_name, email: row.email };
    const accessToken = await issueTokens(res, user);

    res.json({ user: publicUser(user), accessToken });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      await query('UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1', [hashToken(token)]);
    }
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// --- yordamchi funksiyalar ---

async function issueTokens(res, user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '30 days')`,
    [user.id, hashToken(refreshToken)]
  );

  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);
  // accessToken javob body'sida qaytariladi — frontend uni xotirada saqlab
  // Authorization: Bearer header sifatida ishlatadi. Refresh token esa faqat
  // HttpOnly cookie'da turadi (JS orqali o'qib bo'lmaydi).
  return accessToken;
}

function publicUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
  };
}

module.exports = { register, login, refresh, logout, registerSchema, loginSchema };
