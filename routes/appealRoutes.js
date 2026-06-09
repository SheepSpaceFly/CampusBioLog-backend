// src/routes/appealRoutes.js
const express = require('express');
const router = express.Router();
const appealController = require('../controllers/appealController');

// 提交申诉
router.post('/', appealController.createAppeal);

// 获取申诉列表（分页、筛选）
router.get('/', appealController.listAppeals);

// 获取单个申诉详情
router.get('/:appealId', appealController.getAppealById);

// 管理员审核申诉
router.put('/:appealId/review', appealController.reviewAppeal);

// 删除申诉
router.delete('/:appealId', appealController.deleteAppeal);

module.exports = router;