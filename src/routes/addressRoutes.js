const express = require('express');
const { validateBody } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/addressController');

const router = express.Router();
router.use(requireAuth);

router.get('/', ctrl.listAddresses);
router.post('/', validateBody(ctrl.addressSchema), ctrl.createAddress);
router.put('/:id', validateBody(ctrl.addressSchema), ctrl.updateAddress);
router.delete('/:id', ctrl.deleteAddress);

module.exports = router;
