const express = require('express');
const { validateBody } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/questionController');

const router = express.Router({ mergeParams: true });

router.get('/', ctrl.listQuestions);
router.post('/', requireAuth, validateBody(ctrl.questionSchema), ctrl.askQuestion);
router.patch('/:questionId/answer', requireAuth, requireRole('admin'), validateBody(ctrl.answerSchema), ctrl.answerQuestion);

module.exports = router;
