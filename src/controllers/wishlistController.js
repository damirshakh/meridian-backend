const { query } = require('../db/pool');

async function listWishlist(req, res, next) {
  try {
    const result = await query(
      `SELECT p.id, p.name, p.slug, p.price,
              (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order LIMIT 1) AS thumbnail
       FROM wishlist_items w
       JOIN products p ON p.id = w.product_id
       WHERE w.user_id = $1
       ORDER BY w.added_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

async function addToWishlist(req, res, next) {
  try {
    const { productId } = req.params;
    await query(
      `INSERT INTO wishlist_items (user_id, product_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.user.id, productId]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function removeFromWishlist(req, res, next) {
  try {
    const { productId } = req.params;
    await query('DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2', [req.user.id, productId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// Bitta mahsulot sevimlida bor-yo'qligini tekshirish (mahsulot sahifasida yurak holatini ko'rsatish uchun)
async function checkWishlist(req, res, next) {
  try {
    const { productId } = req.params;
    const result = await query('SELECT 1 FROM wishlist_items WHERE user_id = $1 AND product_id = $2', [req.user.id, productId]);
    res.json({ isWishlisted: result.rowCount > 0 });
  } catch (err) {
    next(err);
  }
}

module.exports = { listWishlist, addToWishlist, removeFromWishlist, checkWishlist };
