const { z } = require('zod');
const { query } = require('../db/pool');

const categorySchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'Slug faqat lotin harflar, raqam va tire bo\'lishi mumkin'),
  sortOrder: z.number().int().optional().default(0),
});

async function listCategories(_req, res, next) {
  try {
    const result = await query(
      `SELECT c.id, c.name, c.slug, c.sort_order,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_published = TRUE) AS product_count
       FROM categories c
       ORDER BY c.sort_order ASC, c.name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

async function createCategory(req, res, next) {
  try {
    const { name, slug, sortOrder } = req.body;
    const result = await query(
      'INSERT INTO categories (name, slug, sort_order) VALUES ($1,$2,$3) RETURNING *',
      [name, slug, sortOrder]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function updateCategory(req, res, next) {
  try {
    const { name, slug, sortOrder } = req.body;
    const result = await query(
      'UPDATE categories SET name=$1, slug=$2, sort_order=$3 WHERE id=$4 RETURNING *',
      [name, slug, sortOrder, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Kategoriya topilmadi' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const result = await query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Kategoriya topilmadi' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listCategories, createCategory, updateCategory, deleteCategory, categorySchema };
