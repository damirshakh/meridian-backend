const { z } = require('zod');
const { query } = require('../db/pool');

const questionSchema = z.object({
  question: z.string().min(3).max(500),
});

const answerSchema = z.object({
  answer: z.string().min(1).max(1000),
});

async function listQuestions(req, res, next) {
  try {
    const { productId } = req.params;
    const result = await query(
      `SELECT q.id, q.question, q.answer, q.answered_at, q.created_at, u.full_name AS asked_by
       FROM product_questions q
       JOIN users u ON u.id = q.user_id
       WHERE q.product_id = $1 AND q.is_hidden = FALSE
       ORDER BY q.created_at DESC`,
      [productId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// --- Admin: do'kondagi barcha mahsulotlar bo'yicha javobsiz savollar ro'yxati ---
async function listAllUnanswered(_req, res, next) {
  try {
    const result = await query(
      `SELECT q.id, q.question, q.created_at, u.full_name AS asked_by,
              p.name AS product_name, p.slug AS product_slug
       FROM product_questions q
       JOIN users u ON u.id = q.user_id
       JOIN products p ON p.id = q.product_id
       WHERE q.answer IS NULL AND q.is_hidden = FALSE
       ORDER BY q.created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

async function askQuestion(req, res, next) {
  try {
    const { productId } = req.params;
    const { question } = req.body;
    const result = await query(
      'INSERT INTO product_questions (product_id, user_id, question) VALUES ($1,$2,$3) RETURNING id',
      [productId, req.user.id, question]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
}

// --- Admin: javob berish ---
async function answerQuestion(req, res, next) {
  try {
    const { questionId } = req.params;
    const { answer } = req.body;
    const result = await query(
      `UPDATE product_questions SET answer = $1, answered_by = $2, answered_at = now()
       WHERE id = $3 RETURNING id`,
      [answer, req.user.id, questionId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Savol topilmadi' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listQuestions, listAllUnanswered, askQuestion, answerQuestion, questionSchema, answerSchema };
