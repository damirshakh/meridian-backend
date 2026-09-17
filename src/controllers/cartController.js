const { z } = require('zod');
const { query } = require('../db/pool');

const addItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive().max(20),
});

async function getCart(req, res, next) {
  try {
    const cart = await getOrCreateCart(req.user.id);
    const items = await query(
      `SELECT ci.id, ci.quantity, pv.id AS variant_id, pv.size, pv.color, pv.stock_qty,
              p.id AS product_id, p.name, p.slug,
              COALESCE(pv.price_override, p.price) AS unit_price,
              (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order LIMIT 1) AS thumbnail
       FROM cart_items ci
       JOIN product_variants pv ON pv.id = ci.variant_id
       JOIN products p ON p.id = pv.product_id
       WHERE ci.cart_id = $1
       ORDER BY ci.added_at DESC`,
      [cart.id]
    );

    const subtotal = items.rows.reduce((sum, i) => sum + Number(i.unit_price) * i.quantity, 0);
    res.json({ items: items.rows, subtotal });
  } catch (err) {
    next(err);
  }
}

async function addItem(req, res, next) {
  try {
    const { variantId, quantity } = req.body;
    const cart = await getOrCreateCart(req.user.id);

    const variant = await query('SELECT stock_qty FROM product_variants WHERE id = $1', [variantId]);
    if (variant.rowCount === 0) return res.status(404).json({ error: 'Variant topilmadi' });
    if (variant.rows[0].stock_qty < quantity) {
      return res.status(400).json({ error: 'Yetarli miqdorda mavjud emas', available: variant.rows[0].stock_qty });
    }

    await query(
      `INSERT INTO cart_items (cart_id, variant_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (cart_id, variant_id) DO UPDATE SET quantity = cart_items.quantity + $3`,
      [cart.id, variantId, quantity]
    );

    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function updateItem(req, res, next) {
  try {
    const { itemId } = req.params;
    const quantity = z.number().int().positive().max(20).parse(req.body.quantity);
    const cart = await getOrCreateCart(req.user.id);

    const result = await query(
      'UPDATE cart_items SET quantity = $1 WHERE id = $2 AND cart_id = $3 RETURNING id',
      [quantity, itemId, cart.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Savat elementi topilmadi' });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function removeItem(req, res, next) {
  try {
    const { itemId } = req.params;
    const cart = await getOrCreateCart(req.user.id);
    await query('DELETE FROM cart_items WHERE id = $1 AND cart_id = $2', [itemId, cart.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function getOrCreateCart(userId) {
  const existing = await query('SELECT id FROM carts WHERE user_id = $1', [userId]);
  if (existing.rowCount > 0) return existing.rows[0];
  const created = await query('INSERT INTO carts (user_id) VALUES ($1) RETURNING id', [userId]);
  return created.rows[0];
}

module.exports = { getCart, addItem, updateItem, removeItem, addItemSchema };
