// src/routes/categoryRoutes.js
const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

// ==================== 固定路径（优先级高） ====================

// GET /api/categories/tree - 获取树形结构（必须在 :id 之前）
router.get('/tree', categoryController.getTree);

// GET /api/categories/check-name - 检查名称是否可用
router.get('/check-name', categoryController.checkName);

// GET /api/categories - 分页列表（支持 parentId 筛选）
router.get('/', categoryController.listCategories);

// POST /api/categories - 创建分类
router.post('/', categoryController.createCategory);

// ==================== 带 :id 的动态路径（放在固定路径之后） ====================

// GET /api/categories/:id - 获取单个分类
router.get('/:id', categoryController.getCategoryById);

// GET /api/categories/:id/children - 获取直接子分类
router.get('/:id/children', categoryController.getChildren);

// GET /api/categories/:id/descendants - 获取所有后代
router.get('/:id/descendants', categoryController.getDescendants);

// GET /api/categories/:id/path - 获取路径（从根到当前）
router.get('/:id/path', categoryController.getPath);

// PUT /api/categories/:id - 更新分类
router.put('/:id', categoryController.updateCategory);

// PATCH /api/categories/:id/move - 移动分类（修改父级）
router.patch('/:id/move', categoryController.moveCategory);

// DELETE /api/categories/:id - 删除分类
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;