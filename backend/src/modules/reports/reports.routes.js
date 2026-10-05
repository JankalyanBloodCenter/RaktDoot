'use strict';
const { Router } = require('express');
const controller = require('./reports.controller');
const { authenticate, requireRole } = require('../../middlewares/auth.middleware');

const router = Router();

// Reports are accessible only to managers and admins
router.use(authenticate);
router.use(requireRole('manager', 'admin'));

router.get('/driver', controller.getDriverReport);
router.get('/hospital', controller.getHospitalReport);
router.get('/rejections', controller.getRejectionsReport);
router.get('/declined', controller.getRejectionsReport);
router.get('/export/csv', controller.exportCSV);

module.exports = router;
