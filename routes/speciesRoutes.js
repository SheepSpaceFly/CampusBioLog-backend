// src/routes/speciesRoutes.js
const express = require('express');
const router = express.Router();
const speciesController = require('../controllers/speciesController');

// ==================== 固定路径（优先级高） ====================

// GET /api/species/check-name - 检查物种名称是否可用
router.get('/check-name', speciesController.checkSpeciesName);

// GET /api/species - 分页列表
router.get('/', speciesController.listSpecies);

// POST /api/species - 创建物种
router.post('/', speciesController.createSpecies);

// ==================== 带 :id 的动态路径 ====================

// GET /api/species/:id - 获取单个物种
router.get('/:id', speciesController.getSpeciesById);

// PUT /api/species/:id - 更新物种
router.put('/:id', speciesController.updateSpecies);

// DELETE /api/species/:id - 删除物种
router.delete('/:id', speciesController.deleteSpecies);

module.exports = router;