-- Telegram orqali yuborilgan xabarni keyinroq yangilash (status o'zgarganda) uchun saqlaymiz
ALTER TABLE orders ADD COLUMN telegram_chat_id VARCHAR(50);
ALTER TABLE orders ADD COLUMN telegram_message_id VARCHAR(50);
