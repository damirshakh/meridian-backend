const express = require('express');
const ctrl = require('../controllers/telegramController');

const router = express.Router();

router.post('/webhook', ctrl.handleWebhook);

module.exports = router;
