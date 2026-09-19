const express = require('express');
const ctrl = require('../controllers/homeController');

const router = express.Router();
router.get('/', ctrl.getHomeData);

module.exports = router;
