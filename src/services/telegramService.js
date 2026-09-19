const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const STATUS_LABELS = {
  pending: '🟡 Kutilmoqda',
  confirmed: '🔵 Tasdiqlandi',
  shipped: '🟣 Yo\'lda',
  delivered: '🟢 Yetkazildi',
  cancelled: '🔴 Bekor qilindi',
};

function isConfigured() {
  return Boolean(BOT_TOKEN && CHAT_ID);
}

async function callTelegramApi(method, payload) {
  if (!isConfigured()) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.error('Telegram API xatoligi (asosiy amalga ta\'sir qilmaydi):', err.message);
    return null;
  }
}

function formatOrderMessage(order, items) {
  const itemLines = items
    .map((i) => `• ${i.product_name}${i.size ? ` (${i.size}${i.color ? ', ' + i.color : ''})` : ''} × ${i.quantity} — ${Number(i.unit_price * i.quantity).toLocaleString('ru-RU')} сом`)
    .join('\n');

  return (
    `🛍 <b>Yangi buyurtma №${order.id.slice(0, 8).toUpperCase()}</b>\n\n` +
    `👤 ${order.full_name}\n` +
    `📞 ${order.phone}\n` +
    `📍 ${order.city}, ${order.address_line}\n` +
    (order.notes ? `📝 ${order.notes}\n` : '') +
    `\n<b>Mahsulotlar:</b>\n${itemLines}\n\n` +
    `💰 <b>Jami: ${Number(order.total).toLocaleString('ru-RU')} сом</b>\n` +
    `💳 To'lov: ${order.payment_method === 'cash' ? 'Naqd' : 'Karta'}\n\n` +
    `Holat: ${STATUS_LABELS.pending}`
  );
}

function buildStatusKeyboard(orderId, currentStatus) {
  const buttons = [
    { status: 'confirmed', label: '✅ Tasdiqlash' },
    { status: 'shipped', label: '🚚 Yo\'lda' },
    { status: 'delivered', label: '📦 Yetkazildi' },
    { status: 'cancelled', label: '❌ Bekor qilish' },
  ].filter((b) => b.status !== currentStatus);

  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(
      buttons.slice(i, i + 2).map((b) => ({
        text: b.label,
        callback_data: `order_status:${orderId}:${b.status}`,
      }))
    );
  }
  return { inline_keyboard: rows };
}

async function notifyNewOrder(order, items) {
  if (!isConfigured()) return null;
  const text = formatOrderMessage(order, items);
  const result = await callTelegramApi('sendMessage', {
    chat_id: CHAT_ID,
    text,
    parse_mode: 'HTML',
    reply_markup: buildStatusKeyboard(order.id, order.status),
  });
  if (result?.ok) {
    return { chatId: String(result.result.chat.id), messageId: String(result.result.message_id) };
  }
  return null;
}

async function notifyStatusChange(order) {
  if (!isConfigured()) return;
  await callTelegramApi('sendMessage', {
    chat_id: CHAT_ID,
    text: `Buyurtma №${order.id.slice(0, 8).toUpperCase()} holati: ${STATUS_LABELS[order.status] || order.status}`,
    parse_mode: 'HTML',
  });
}

async function answerCallbackQuery(callbackQueryId, text) {
  await callTelegramApi('answerCallbackQuery', { callback_query_id: callbackQueryId, text });
}

async function editMessageText(chatId, messageId, text, replyMarkup) {
  await callTelegramApi('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    reply_markup: replyMarkup,
  });
}

module.exports = {
  isConfigured,
  notifyNewOrder,
  notifyStatusChange,
  answerCallbackQuery,
  editMessageText,
  formatOrderMessage,
  buildStatusKeyboard,
  STATUS_LABELS,
};
