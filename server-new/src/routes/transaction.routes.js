const express = require('express');
const transactionController = require('../controllers/transaction.controller');
const { authenticate } = require('../middleware/auth.middleware');
const validate = require('../middleware/validation.middleware');
const {
  createTransactionSchema,
  updateTransactionSchema,
  listTransactionsSchema,
} = require('../validators/transaction.validator');

const router = express.Router();

router.use(authenticate);

router.get('/stats/summary', transactionController.summary);
router.get('/', validate(listTransactionsSchema, { query: true }), transactionController.list);
router.post('/', validate(createTransactionSchema), transactionController.create);
router.get('/:id', transactionController.get);
router.put('/:id', validate(updateTransactionSchema), transactionController.update);
router.patch('/:id', validate(updateTransactionSchema), transactionController.update);
router.delete('/:id', transactionController.remove);

module.exports = router;