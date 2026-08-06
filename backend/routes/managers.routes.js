
import express from 'express';
import * as managersController from '../controllers/managers.controller.js';

const router = express.Router();

router.get('/', managersController.getManagers);
router.get('/mappings', managersController.getMappings);
router.post('/', managersController.createManager);
router.delete('/:id', managersController.removeManager);

export default router;
