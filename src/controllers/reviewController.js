const { z } = require('zod');
const { query } = require('../db/pool');

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  images: z.array(z.string().url()).max(5).optional().default([]),
});

async function listReviews(req, res, next) {
  try {
    const { productId } = req.params;

    const reviews = await query(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.full_name,
              (SELECT json_agg(url) FROM review_images WHERE review_id = r.id) AS images
       FROM product_reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.product_id = $1 AND r.is_hidden = FALSE
       ORDER BY r.created_at DESC`,
      [productId]
    );

    const summary = await query(
      `SELECT COUNT(*) AS total, COALESCE(AVG(rating), 0) AS average,
              COUNT(*) FILTER (WHERE rating = 5) AS star5,
              COUNT(*) FILTER (WHERE rating = 4) AS star4,
              COUNT(*) FILTER (WHERE rating = 3) AS star3,
              COUNT(*) FILTER (WHERE rating = 2) AS star2,
              COUNT(*) FILTER (WHERE rating = 1) AS star1
       FROM product_reviews WHERE product_id = $1 AND is_hidden = FALSE`,
      [productId]
    );

    res.json({
      reviews: reviews.rows,
      summary: {
        total: parseInt(summary.rows[0].total, 10),
        average: parseFloat(summary.rows[0].average).toFixed(1),
        breakdown: {
          5: parseInt(summary.rows[0].star5, 10),
          4: parseInt(summary.rows[0].star4, 10),
          3: parseInt(summary.rows[0].star3, 10),
          2: parseInt(summary.rows[0].star2, 10),
          1: parseInt(summary.rows[0].star1, 10),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

async function createReview(req, res, next) {
  try {
    const { productId } = req.params;
    const { rating, comment, images } = req.body;

    // Mijoz haqiqatan shu mahsulotni sotib olganini tekshiramiz (ixtiyoriy, lekin ishonchni oshiradi)
    const purchased = await query(
      `SELECT o.id FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN product_variants pv ON pv.id = oi.variant_id
       WHERE o.user_id = $1 AND pv.product_id = $2 AND o.status != 'cancelled'
       LIMIT 1`,
      [req.user.id, productId]
    );
    const orderId = purchased.rows[0]?.id || null;

    const result = await query(
      `INSERT INTO product_reviews (product_id, user_id, order_id, rating, comment)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (product_id, user_id) DO UPDATE SET rating = $4, comment = $5
       RETURNING id`,
      [productId, req.user.id, orderId, rating, comment || null]
    );
    const reviewId = result.rows[0].id;

    // Eski rasmlarni tozalab, yangilarini qo'shamiz (agar tahrirlangan bo'lsa)
    await query('DELETE FROM review_images WHERE review_id = $1', [reviewId]);
    for (const url of images) {
      await query('INSERT INTO review_images (review_id, url) VALUES ($1, $2)', [reviewId, url]);
    }

    res.status(201).json({ success: true, verifiedPurchase: Boolean(orderId) });
  } catch (err) {
    next(err);
  }
}

async function deleteReview(req, res, next) {
  try {
    const { reviewId } = req.params;
    // O'ziniki bo'lsa yoki admin bo'lsa o'chira oladi
    const cond = req.user.role === 'admin' ? 'id = $1' : 'id = $1 AND user_id = $2';
    const params = req.user.role === 'admin' ? [reviewId] : [reviewId, req.user.id];
    const result = await query(`DELETE FROM product_reviews WHERE ${cond}`, params);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Sharh topilmadi yoki ruxsat yo\'q' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// --- Admin: moderatsiya ---
async function hideReview(req, res, next) {
  try {
    await query('UPDATE product_reviews SET is_hidden = TRUE WHERE id = $1', [req.params.reviewId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listReviews, createReview, deleteReview, hideReview, reviewSchema };
