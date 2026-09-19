const { query } = require('../db/pool');

const PRODUCT_CARD_FIELDS = `
  p.id, p.name, p.slug, p.price, p.compare_at_price,
  (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order LIMIT 1) AS thumbnail
`;

// Bosh sahifa uchun bitta so'rovda: bannerlar + yangi + chegirmadagi + trend mahsulotlar.
// Bir nechta alohida so'rov o'rniga shu yerda parallel bajarish ilovani sezilarli tezlashtiradi.
async function getHomeData(_req, res, next) {
  try {
    const [banners, newArrivals, onSale, trending] = await Promise.all([
      query('SELECT * FROM banners WHERE is_active = TRUE ORDER BY sort_order ASC'),
      query(
        `SELECT ${PRODUCT_CARD_FIELDS} FROM products p
         WHERE p.is_published = TRUE
         ORDER BY p.created_at DESC LIMIT 10`
      ),
      query(
        `SELECT ${PRODUCT_CARD_FIELDS} FROM products p
         WHERE p.is_published = TRUE AND p.compare_at_price IS NOT NULL AND p.compare_at_price > p.price
         ORDER BY p.created_at DESC LIMIT 10`
      ),
      query(
        `SELECT ${PRODUCT_CARD_FIELDS} FROM products p
         WHERE p.is_published = TRUE AND p.is_trending = TRUE
         ORDER BY p.created_at DESC LIMIT 10`
      ),
    ]);

    res.json({
      banners: banners.rows,
      newArrivals: newArrivals.rows,
      onSale: onSale.rows,
      trending: trending.rows,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getHomeData };
