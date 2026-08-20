const express = require('express');
const goalController = require('../controllers/goal.controller');
const { authenticate } = require('../middleware/auth.middleware');
const validate = require('../middleware/validation.middleware');
const { createGoalSchema, updateGoalSchema, contributeGoalSchema } = require('../validators/goal.validator');

const router = express.Router();

router.use(authenticate);

router.get('/', goalController.list);
router.post('/', validate(createGoalSchema), goalController.create);
router.post('/:id/contribute', validate(contributeGoalSchema), goalController.contribute);
router.get('/:id', goalController.get);
router.put('/:id', validate(updateGoalSchema), goalController.update);
router.patch('/:id', validate(updateGoalSchema), goalController.update);
router.delete('/:id', goalController.remove);

module.exports = router;