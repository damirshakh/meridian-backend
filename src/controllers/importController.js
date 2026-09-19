const { parse } = require('csv-parse/sync');
const { query, withTransaction } = require('../db/pool');

/**
 * CSV formati (bitta qator = bitta variant; bir xil 'slug'ga ega qatorlar
 * bitta mahsulotning turli o'lcham/rangdagi variantlari sifatida guruhlanadi):
 *
 * name,slug,description,price,compareAtPrice,brand,categoryName,isTrending,size,color,sku,stockQty,imageUrl
 */
const REQUIRED_COLUMNS = ['name', 'slug', 'price', 'sku', 'stockQty'];

async function importProducts(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'CSV fayl tanlanmadi' });

    let records;
    try {
      records = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
    } catch (parseErr) {
      return res.status(400).json({ error: `CSV faylni o'qib bo'lmadi: ${parseErr.message}` });
    }

    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV fayl bo\'sh' });
    }

    const missingColumns = REQUIRED_COLUMNS.filter((col) => !(col in records[0]));
    if (missingColumns.length > 0) {
      return res.status(400).json({ error: `Quyidagi ustunlar yo'q: ${missingColumns.join(', ')}` });
    }

    const groups = new Map();
    for (const row of records) {
      if (!groups.has(row.slug)) groups.set(row.slug, []);
      groups.get(row.slug).push(row);
    }

    const results = { created: 0, updated: 0, errors: [] };

    for (const [slug, rows] of groups) {
      try {
        const outcome = await withTransaction(async (client) => {
          const first = rows[0];

          if (!first.name || !first.price) {
            throw new Error('name va price maydonlari majburiy');
          }
          if (!slug) {
            throw new Error('slug maydoni majburiy');
          }

          let categoryId = null;
          if (first.categoryName) {
            const catSlug = first.categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const existingCat = await client.query('SELECT id FROM categories WHERE slug = $1', [catSlug]);
            if (existingCat.rowCount > 0) {
              categoryId = existingCat.rows[0].id;
            } else {
              const newCat = await client.query(
                'INSERT INTO categories (name, slug) VALUES ($1, $2) RETURNING id',
                [first.categoryName, catSlug]
              );
              categoryId = newCat.rows[0].id;
            }
          }

          const existingProduct = await client.query('SELECT id FROM products WHERE slug = $1', [slug]);
          let productId;
          let wasCreated;
          if (existingProduct.rowCount > 0) {
            productId = existingProduct.rows[0].id;
            wasCreated = false;
            await client.query(
              `UPDATE products SET name=$1, description=$2, price=$3, compare_at_price=$4, brand=$5, category_id=$6, is_trending=$7
               WHERE id=$8`,
              [
                first.name, first.description || null, parseFloat(first.price),
                first.compareAtPrice ? parseFloat(first.compareAtPrice) : null,
                first.brand || null, categoryId,
                String(first.isTrending).toLowerCase() === 'true',
                productId,
              ]
            );
          } else {
            wasCreated = true;
            const created = await client.query(
              `INSERT INTO products (name, slug, description, price, compare_at_price, brand, category_id, is_trending)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
              [
                first.name, slug, first.description || null, parseFloat(first.price),
                first.compareAtPrice ? parseFloat(first.compareAtPrice) : null,
                first.brand || null, categoryId,
                String(first.isTrending).toLowerCase() === 'true',
              ]
            );
            productId = created.rows[0].id;
          }

          for (const row of rows) {
            if (!row.sku) throw new Error(`"${slug}" uchun sku ko'rsatilmagan`);
            await client.query(
              `INSERT INTO product_variants (product_id, size, color, sku, stock_qty)
               VALUES ($1,$2,$3,$4,$5)
               ON CONFLICT (sku) DO UPDATE SET stock_qty = $5, size = $2, color = $3`,
              [productId, row.size || null, row.color || null, row.sku, parseInt(row.stockQty, 10) || 0]
            );

            if (row.imageUrl) {
              const existingImg = await client.query(
                'SELECT id FROM product_images WHERE product_id = $1 AND url = $2',
                [productId, row.imageUrl]
              );
              if (existingImg.rowCount === 0) {
                await client.query(
                  'INSERT INTO product_images (product_id, url, sort_order) VALUES ($1, $2, 0)',
                  [productId, row.imageUrl]
                );
              }
            }
          }

          return { wasCreated };
        });

        // Faqat tranzaksiya MUVAFFAQIYATLI yakunlangandan keyin hisoblaymiz —
        // aks holda ROLLBACK bo'lgan mahsulot ham "yaratildi" deb ko'rsatilib qolardi.
        if (outcome.wasCreated) results.created++;
        else results.updated++;
      } catch (groupErr) {
        results.errors.push({ slug, error: groupErr.message });
      }
    }

    await query(
      `INSERT INTO audit_logs (actor_id, action, entity, meta) VALUES ($1,'product.bulk_import','product',$2)`,
      [req.user.id, JSON.stringify({ created: results.created, updated: results.updated, errorCount: results.errors.length })]
    );

    res.json(results);
  } catch (err) {
    next(err);
  }
}

module.exports = { importProducts };
