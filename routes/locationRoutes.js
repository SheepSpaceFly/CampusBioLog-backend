// src/routes/locationRoutes.js
const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');

// GET /api/locations - 分页列表（支持 keyword 筛选）
router.get('/', locationController.listLocations);

// POST /api/locations - 创建地点
router.post('/', locationController.createLocation);

// GET /api/locations/:id - 获取单个地点
router.get('/:id', locationController.getLocationById);

// PUT /api/locations/:id - 更新地点
router.put('/:id', locationController.updateLocation);

// DELETE /api/locations/:id - 删除地点
router.delete('/:id', locationController.deleteLocation);

module.exports = router;