const { z } = require('zod');
const { query, withTransaction } = require('../db/pool');
const { validatePromoCode } = require('./promoController');
const { sendPushToUser } = require('./pushController');
const telegram = require('../services/telegramService');

const DELIVERY_FEE = 200; // sodda: shahar ichida qat'iy yetkazib berish narxi (сом)

const createOrderSchema = z.object({
  fullName: z.string().min(2).max(150),
  phone: z.string().min(9).max(20),
  city: z.string().min(2).max(100),
  addressLine: z.string().min(3).max(255),
  notes: z.string().max(500).optional(),
  paymentMethod: z.enum(['cash', 'card']).default('cash'),
  promoCode: z.string().max(50).optional(),
});

// Savatdagi mahsulotlardan buyurtma yaratadi — tranzaksiya ichida stokni ham kamaytiradi
async function createOrder(req, res, next) {
  try {
    const data = req.body;

    const txResult = await withTransaction(async (client) => {
      const cartResult = await client.query('SELECT id FROM carts WHERE user_id = $1', [req.user.id]);
      if (cartResult.rowCount === 0) {
        const err = new Error('Savat topilmadi');
        err.status = 400;
        throw err;
      }
      const cartId = cartResult.rows[0].id;

      // FOR UPDATE — bir vaqtda ikkita buyurtma bir xil stokni band qilib qo'ymasligi uchun qulflaymiz
      const itemsResult = await client.query(
        `SELECT ci.id, ci.quantity, pv.id AS variant_id, pv.size, pv.color, pv.stock_qty,
                p.name AS product_name, COALESCE(pv.price_override, p.price) AS unit_price
         FROM cart_items ci
         JOIN product_variants pv ON pv.id = ci.variant_id
         JOIN products p ON p.id = pv.product_id
         WHERE ci.cart_id = $1
         FOR UPDATE OF pv`,
        [cartId]
      );

      if (itemsResult.rowCount === 0) {
        const err = new Error('Savat bo\'sh');
        err.status = 400;
        throw err;
      }

      for (const item of itemsResult.rows) {
        if (item.stock_qty < item.quantity) {
          const err = new Error(`"${item.product_name}" uchun yetarli miqdor yo'q`);
          err.status = 400;
          throw err;
        }
      }

      const subtotal = itemsResult.rows.reduce((sum, i) => sum + Number(i.unit_price) * i.quantity, 0);

      // Promokod qo'llanilgan bo'lsa, uni tekshiramiz va chegirmani hisoblaymiz
      let discountAmount = 0;
      let promoId = null;
      if (data.promoCode) {
        const promoResult = await validatePromoCode(data.promoCode, subtotal, client);
        if (!promoResult.valid) {
          const err = new Error(promoResult.error);
          err.status = 400;
          throw err;
        }
        discountAmount = promoResult.discountAmount;
        promoId = promoResult.promo.id;
      }

      const total = subtotal + DELIVERY_FEE - discountAmount;

      const orderResult = await client.query(
        `INSERT INTO orders (user_id, payment_method, subtotal, delivery_fee, discount_amount, promo_code_id, total,
                              full_name, phone, city, address_line, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [req.user.id, data.paymentMethod, subtotal, DELIVERY_FEE, discountAmount, promoId, total,
         data.fullName, data.phone, data.city, data.addressLine, data.notes || null]
      );
      const order = orderResult.rows[0];

      if (promoId) {
        await client.query('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1', [promoId]);
      }

      for (const item of itemsResult.rows) {
        await client.query(
          `INSERT INTO order_items (order_id, variant_id, product_name, size, color, unit_price, quantity)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [order.id, item.variant_id, item.product_name, item.size, item.color, item.unit_price, item.quantity]
        );
        await client.query(
          'UPDATE product_variants SET stock_qty = stock_qty - $1 WHERE id = $2',
          [item.quantity, item.variant_id]
        );
      }

      await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);

      return { order, items: itemsResult.rows };
    });

    // Tranzaksiya muvaffaqiyatli yakunlangach, Telegram'ga xabar yuboramiz.
    // Bu ataylab tranzaksiyadan TASHQARIDA — Telegram bilan bog'lanish sekin yoki
    // muvaffaqiyatsiz bo'lsa ham, buyurtmaning o'zi baribir saqlangan bo'lishi kerak.
    const telegramInfo = await telegram.notifyNewOrder(txResult.order, txResult.items);
    if (telegramInfo) {
      await query(
        'UPDATE orders SET telegram_chat_id = $1, telegram_message_id = $2 WHERE id = $3',
        [telegramInfo.chatId, telegramInfo.messageId, txResult.order.id]
      );
    }

    res.status(201).json(txResult.order);
  } catch (err) {
    next(err);
  }
}

async function listMyOrders(req, res, next) {
  try {
    // Har bir buyurtma uchun: nechta mahsulot, birinchi mahsulot rasmi va nomi (kartochka ko'rinishi uchun)
    const result = await query(
      `SELECT o.id, o.status, o.payment_method, o.payment_status, o.total, o.created_at,
              (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count,
              (
                SELECT json_build_object(
                  'productName', oi.product_name,
                  'thumbnail', (
                    SELECT pi.url FROM product_variants pv
                    JOIN product_images pi ON pi.product_id = pv.product_id
                    WHERE pv.id = oi.variant_id
                    ORDER BY pi.sort_order LIMIT 1
                  )
                )
                FROM order_items oi WHERE oi.order_id = o.id
                ORDER BY oi.id LIMIT 1
              ) AS first_item
       FROM orders o
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

async function getMyOrder(req, res, next) {
  try {
    const orderResult = await query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    const order = orderResult.rows[0];
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });

    const items = await query(
      `SELECT oi.*,
              (SELECT pi.url FROM product_images pi WHERE pi.product_id = pv.product_id ORDER BY pi.sort_order LIMIT 1) AS thumbnail
       FROM order_items oi
       JOIN product_variants pv ON pv.id = oi.variant_id
       WHERE oi.order_id = $1`,
      [order.id]
    );
    res.json({ ...order, items: items.rows });
  } catch (err) {
    next(err);
  }
}

// Avvalgi buyurtmadagi mahsulotlarni joriy savatga qayta qo'shadi.
// Stokda mavjud bo'lmagan yoki o'chirilgan variantlar jim o'tkazib yuboriladi,
// natijada nechtasi qo'shilgani va nechtasi o'tkazib yuborilgani qaytariladi.
async function reorderItems(req, res, next) {
  try {
    const orderResult = await query('SELECT id FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (orderResult.rowCount === 0) return res.status(404).json({ error: 'Buyurtma topilmadi' });

    const items = await query('SELECT variant_id, quantity FROM order_items WHERE order_id = $1', [req.params.id]);

    const cartResult = await query('SELECT id FROM carts WHERE user_id = $1', [req.user.id]);
    const cartId = cartResult.rows[0].id;

    let added = 0;
    let skipped = 0;

    for (const item of items.rows) {
      const variant = await query('SELECT stock_qty FROM product_variants WHERE id = $1', [item.variant_id]);
      if (variant.rowCount === 0 || variant.rows[0].stock_qty < 1) {
        skipped++;
        continue;
      }
      const qtyToAdd = Math.min(item.quantity, variant.rows[0].stock_qty);
      await query(
        `INSERT INTO cart_items (cart_id, variant_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (cart_id, variant_id) DO UPDATE SET quantity = cart_items.quantity + $3`,
        [cartId, item.variant_id, qtyToAdd]
      );
      added++;
    }

    res.json({ added, skipped });
  } catch (err) {
    next(err);
  }
}

// ---- Admin: barcha buyurtmalar va status boshqaruvi ----
async function listAllOrders(req, res, next) {
  try {
    const status = req.query.status;
    const params = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE status = $${params.length}`;
    }
    const result = await query(
      `SELECT o.id, o.status, o.total, o.payment_status, o.created_at, u.full_name AS customer_name,
              (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
       FROM orders o JOIN users u ON u.id = o.user_id
       ${where} ORDER BY o.created_at DESC LIMIT 200`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

const statusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']),
});

// Admin: bitta buyurtmaning to'liq tafsilotlari (kim, nima, qancha, qaysi o'lcham/rangda)
async function getOrderById(req, res, next) {
  try {
    const orderResult = await query(
      `SELECT o.*, u.full_name AS customer_name, u.email AS customer_email, u.phone AS customer_phone
       FROM orders o JOIN users u ON u.id = o.user_id
       WHERE o.id = $1`,
      [req.params.id]
    );
    const order = orderResult.rows[0];
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });

    const items = await query(
      `SELECT oi.*,
              (SELECT pi.url FROM product_images pi WHERE pi.product_id = pv.product_id ORDER BY pi.sort_order LIMIT 1) AS thumbnail
       FROM order_items oi
       JOIN product_variants pv ON pv.id = oi.variant_id
       WHERE oi.order_id = $1`,
      [order.id]
    );
    res.json({ ...order, items: items.rows });
  } catch (err) {
    next(err);
  }
}

// Buyurtma statusini o'zgartirish uchun umumiy funksiya — bu HTTP so'rovidan ham
// (admin panel), Telegram tugmasi bosilganidan ham chaqiriladi, shuning uchun
// ikkalasi ham bir xil natija (audit log, push, Telegram xabarini yangilash) beradi.
async function applyOrderStatusChange(orderId, status, actorId) {
  const result = await query('UPDATE orders SET status = $1 WHERE id = $2 RETURNING *', [status, orderId]);
  if (result.rowCount === 0) return null;
  const order = result.rows[0];

  if (actorId) {
    await query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, meta)
       VALUES ($1,'order.status_update','order',$2,$3)`,
      [actorId, orderId, JSON.stringify({ status })]
    );
  }

  const STATUS_LABELS = {
    pending: 'kutilmoqda', confirmed: 'tasdiqlandi', shipped: "yo'lda",
    delivered: 'yetkazildi', cancelled: 'bekor qilindi',
  };
  await sendPushToUser(
    order.user_id,
    'Buyurtma holati yangilandi',
    `Buyurtmangiz holati: ${STATUS_LABELS[status] || status}`,
    { orderId }
  );

  if (order.telegram_chat_id && order.telegram_message_id) {
    const items = await query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
    const text = telegram.formatOrderMessage(order, items.rows).replace(
      /Holat: .+$/,
      `Holat: ${telegram.STATUS_LABELS[status] || status}`
    );
    await telegram.editMessageText(
      order.telegram_chat_id,
      order.telegram_message_id,
      text,
      telegram.buildStatusKeyboard(order.id, status)
    );
  }

  return order;
}

async function updateOrderStatus(req, res, next) {
  try {
    const { status } = req.body;
    const order = await applyOrderStatusChange(req.params.id, status, req.user.id);
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    res.json(order);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOrder,
  listMyOrders,
  getMyOrder,
  getOrderById,
  reorderItems,
  listAllOrders,
  updateOrderStatus,
  applyOrderStatusChange,
  createOrderSchema,
  statusSchema,
};
