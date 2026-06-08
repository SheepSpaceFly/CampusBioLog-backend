// src/routes/identificationRequestRoutes.js
const express = require('express');
const router = express.Router();
const identificationRequestController = require('../controllers/identificationRequestController');

// 创建鉴定请求
router.post('/', identificationRequestController.createRequest);

// 获取鉴定请求列表（支持分页、筛选）
router.get('/', identificationRequestController.listRequests);

// 获取单个鉴定请求
router.get('/:reqId', identificationRequestController.getRequestById);

// 更新鉴定请求（鉴定/拒绝）
router.put('/:reqId', identificationRequestController.updateRequest);

// 删除鉴定请求
router.delete('/:reqId', identificationRequestController.deleteRequest);

module.exports = router;