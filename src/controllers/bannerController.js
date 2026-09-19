const { z } = require('zod');
const { query } = require('../db/pool');

const bannerSchema = z.object({
  title: z.string().max(150).optional(),
  subtitle: z.string().max(255).optional(),
  imageUrl: z.string().url(),
  linkType: z.enum(['none', 'product', 'category', 'url']).default('none'),
  linkValue: z.string().max(255).optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

async function listActiveBanners(_req, res, next) {
  try {
    const result = await query(
      'SELECT * FROM banners WHERE is_active = TRUE ORDER BY sort_order ASC'
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// --- Admin ---
async function listAllBanners(_req, res, next) {
  try {
    const result = await query('SELECT * FROM banners ORDER BY sort_order ASC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

async function createBanner(req, res, next) {
  try {
    const d = req.body;
    const result = await query(
      `INSERT INTO banners (title, subtitle, image_url, link_type, link_value, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [d.title || null, d.subtitle || null, d.imageUrl, d.linkType, d.linkValue || null, d.sortOrder, d.isActive]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function updateBanner(req, res, next) {
  try {
    const d = req.body;
    const result = await query(
      `UPDATE banners SET title=$1, subtitle=$2, image_url=$3, link_type=$4, link_value=$5, sort_order=$6, is_active=$7
       WHERE id=$8 RETURNING *`,
      [d.title || null, d.subtitle || null, d.imageUrl, d.linkType, d.linkValue || null, d.sortOrder, d.isActive, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Banner topilmadi' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function deleteBanner(req, res, next) {
  try {
    await query('DELETE FROM banners WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listActiveBanners, listAllBanners, createBanner, updateBanner, deleteBanner, bannerSchema };
