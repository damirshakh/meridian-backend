const telegram = require('../services/telegramService');
const { applyOrderStatusChange } = require('./orderController');

async function handleWebhook(req, res) {
  try {
    const update = req.body;

    if (update.callback_query) {
      const { id: callbackQueryId, data } = update.callback_query;

      if (data && data.startsWith('order_status:')) {
        const [, orderId, status] = data.split(':');
        const order = await applyOrderStatusChange(orderId, status, null);

        if (order) {
          await telegram.answerCallbackQuery(callbackQueryId, '✅ Holat yangilandi');
        } else {
          await telegram.answerCallbackQuery(callbackQueryId, '❌ Buyurtma topilmadi');
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Telegram webhook xatoligi:', err.message);
    res.sendStatus(200);
  }
}

module.exports = { handleWebhook };
