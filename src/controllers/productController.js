const { z } = require('zod');
const { query, withTransaction } = require('../db/pool');

// ---- Mijoz tomoni: mahsulotlar ro'yxati (filtr, qidiruv, sahifalash) ----
async function listProducts(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;

    const conditions = ['p.is_published = TRUE'];
    const params = [];

    if (req.query.category) {
      params.push(req.query.category);
      conditions.push(`c.slug = $${params.length}`);
    }
    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      conditions.push(`p.name ILIKE $${params.length}`);
    }
    if (req.query.minPrice) {
      params.push(req.query.minPrice);
      conditions.push(`p.price >= $${params.length}`);
    }
    if (req.query.maxPrice) {
      params.push(req.query.maxPrice);
      conditions.push(`p.price <= $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const sortMap = {
      price_asc: 'p.price ASC',
      price_desc: 'p.price DESC',
      newest: 'p.created_at DESC',
    };
    const orderBy = sortMap[req.query.sort] || 'p.created_at DESC';

    params.push(limit, offset);
    const result = await query(
      `SELECT p.id, p.name, p.slug, p.price, p.compare_at_price, p.brand,
              c.name AS category_name,
              (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY sort_order LIMIT 1) AS thumbnail
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM products p LEFT JOIN categories c ON c.id = p.category_id ${whereClause}`,
      params.slice(0, params.length - 2)
    );

    res.json({
      products: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count, 10),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getProductBySlug(req, res, next) {
  try {
    const productResult = await query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.slug = $1 AND p.is_published = TRUE`,
      [req.params.slug]
    );
    const product = productResult.rows[0];
    if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });

    const [images, variants, ratingSummary] = await Promise.all([
      query('SELECT id, url, sort_order FROM product_images WHERE product_id = $1 ORDER BY sort_order', [product.id]),
      query('SELECT id, size, color, sku, stock_qty, price_override FROM product_variants WHERE product_id = $1', [product.id]),
      query(
        `SELECT COUNT(*) AS total, COALESCE(AVG(rating), 0) AS average
         FROM product_reviews WHERE product_id = $1 AND is_hidden = FALSE`,
        [product.id]
      ),
    ]);

    res.json({
      ...product,
      images: images.rows,
      variants: variants.rows,
      rating: {
        average: parseFloat(ratingSummary.rows[0].average).toFixed(1),
        count: parseInt(ratingSummary.rows[0].total, 10),
      },
    });
  } catch (err) {
    next(err);
  }
}

// Bir xil kategoriyadagi boshqa mahsulotlar — "shunga o'xshash" bloki uchun
async function getSimilarProducts(req, res, next) {
  try {
    const productResult = await query('SELECT id, category_id FROM products WHERE slug = $1', [req.params.slug]);
    const product = productResult.rows[0];
    if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });

    const result = await query(
      `SELECT p.id, p.name, p.slug, p.price,
              (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order LIMIT 1) AS thumbnail
       FROM products p
       WHERE p.category_id = $1 AND p.id != $2 AND p.is_published = TRUE
       ORDER BY p.created_at DESC
       LIMIT 8`,
      [product.category_id, product.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

async function listCategories(_req, res, next) {
  try {
    const result = await query('SELECT id, name, slug, parent_id FROM categories ORDER BY sort_order');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// ---- Admin tomoni: mahsulot yaratish/tahrirlash ----

const productSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(220).regex(/^[a-z0-9-]+$/, 'Slug faqat lotin harflar, raqam va tire bo\'lishi mumkin'),
  description: z.string().optional(),
  price: z.number().positive(),
  compareAtPrice: z.number().positive().optional(),
  brand: z.string().max(100).optional(),
  categoryId: z.string().uuid().optional(),
  isPublished: z.boolean().optional().default(true),
  isTrending: z.boolean().optional().default(false),
  variants: z
    .array(
      z.object({
        size: z.string().optional(),
        color: z.string().optional(),
        sku: z.string().min(1),
        stockQty: z.number().int().nonnegative(),
        priceOverride: z.number().positive().optional(),
      })
    )
    .min(1, 'Kamida 1 ta variant (o\'lcham/rang) kerak'),
  images: z.array(z.string().url()).optional().default([]),
});

async function createProduct(req, res, next) {
  try {
    const data = req.body;
    const product = await withTransaction(async (client) => {
      const productResult = await client.query(
        `INSERT INTO products (name, slug, description, price, compare_at_price, brand, category_id, is_published, is_trending)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [data.name, data.slug, data.description || null, data.price, data.compareAtPrice || null,
         data.brand || null, data.categoryId || null, data.isPublished, data.isTrending]
      );
      const product = productResult.rows[0];

      for (const v of data.variants) {
        await client.query(
          `INSERT INTO product_variants (product_id, size, color, sku, stock_qty, price_override)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [product.id, v.size || null, v.color || null, v.sku, v.stockQty, v.priceOverride || null]
        );
      }

      let order = 0;
      for (const url of data.images) {
        await client.query(
          'INSERT INTO product_images (product_id, url, sort_order) VALUES ($1,$2,$3)',
          [product.id, url, order++]
        );
      }

      await client.query(
        `INSERT INTO audit_logs (actor_id, action, entity, entity_id, meta)
         VALUES ($1,'product.create','product',$2,$3)`,
        [req.user.id, product.id, JSON.stringify({ name: product.name })]
      );

      return product;
    });

    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const data = req.body;

    const result = await query(
      `UPDATE products SET name=$1, description=$2, price=$3, compare_at_price=$4,
        brand=$5, category_id=$6, is_published=$7, is_trending=$8
       WHERE id=$9 RETURNING *`,
      [data.name, data.description || null, data.price, data.compareAtPrice || null,
       data.brand || null, data.categoryId || null, data.isPublished, data.isTrending, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Mahsulot topilmadi' });

    await query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id) VALUES ($1,'product.update','product',$2)`,
      [req.user.id, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM products WHERE id=$1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Mahsulot topilmadi' });

    await query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id) VALUES ($1,'product.delete','product',$2)`,
      [req.user.id, id]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProducts,
  getProductBySlug,
  getSimilarProducts,
  listCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  productSchema,
};
