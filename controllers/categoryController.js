// src/controllers/categoryController.js
const categoryModel = require('../models/categoryModel');
const { formatCategory } = require('../utils/format');

// ==================== CRUD 基础操作 ====================

/** GET /api/categories/:id - 获取单个分类 */
exports.getCategoryById = async (req, res, next) => {
  try {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return res.status(400).json({ success: false, message: '分类ID不合法' });
    }
    const category = await categoryModel.getById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: '分类不存在' });
    }
    res.json({ success: true, data: formatCategory(category) });
  } catch (err) {
    next(err);
  }
};

/** POST /api/categories - 创建分类 */
exports.createCategory = async (req, res, next) => {
  try {
    const { name, parentId } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: '分类名称不能为空' });
    }

    // 校验父分类是否存在（如果传了parentId且不为null）
    const parentIdVal = parentId !== undefined && parentId !== null ? parseInt(parentId) : null;
    if (parentIdVal !== null) {
      if (isNaN(parentIdVal)) {
        return res.status(400).json({ success: false, message: '父分类ID不合法' });
      }
      const parentExists = await categoryModel.exists(parentIdVal);
      if (!parentExists) {
        return res.status(404).json({ success: false, message: '父分类不存在' });
      }
    }

    // 检查同一父级下名称是否重复
    const nameExists = await categoryModel.isNameUnderParentExists(name, parentIdVal);
    if (nameExists) {
      return res.status(409).json({ success: false, message: '同级分类下已存在相同名称' });
    }

    const newCategory = await categoryModel.create(name, parentIdVal);
    const created = await categoryModel.getById(newCategory.category_id);
    res.status(201).json({ success: true, data: formatCategory(created) });
  } catch (err) {
    next(err);
  }
};

/** PUT /api/categories/:id - 更新分类 */
exports.updateCategory = async (req, res, next) => {
  try {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return res.status(400).json({ success: false, message: '分类ID不合法' });
    }

    const existing = await categoryModel.getById(categoryId);
    if (!existing) {
      return res.status(404).json({ success: false, message: '分类不存在' });
    }

    const { name, parentId } = req.body;
    const updateData = {};

    // 处理名称更新
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ success: false, message: '分类名称不能为空' });
      }
      updateData.name = name;
    }

    // 处理父分类更新
    let newParentId = existing.parent_id;
    if (parentId !== undefined) {
      newParentId = parentId === null ? null : parseInt(parentId);
      if (newParentId !== null && isNaN(newParentId)) {
        return res.status(400).json({ success: false, message: '父分类ID不合法' });
      }
      // 检查新的父分类是否存在
      if (newParentId !== null && !(await categoryModel.exists(newParentId))) {
        return res.status(404).json({ success: false, message: '父分类不存在' });
      }
      // 检查循环依赖（不能将自己或自己的后代设为父分类）
      if (newParentId !== null) {
        const isCyclic = await categoryModel.checkCyclic(categoryId, newParentId);
        if (isCyclic) {
          return res.status(400).json({ success: false, message: '不能将分类移动到自己的子分类下，会形成循环依赖' });
        }
      }
      updateData.parentId = newParentId;
    }

    // 检查同一父级下名称是否重复（如果名称或父级有变化）
    if ((name !== undefined && name !== existing.name) || (parentId !== undefined && newParentId !== existing.parent_id)) {
      const nameExists = await categoryModel.isNameUnderParentExists(
        updateData.name || existing.name,
        newParentId !== undefined ? newParentId : existing.parent_id,
        categoryId
      );
      if (nameExists) {
        return res.status(409).json({ success: false, message: '同级分类下已存在相同名称' });
      }
    }

    await categoryModel.update(categoryId, updateData);
    const updated = await categoryModel.getById(categoryId);
    res.json({ success: true, data: formatCategory(updated) });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/categories/:id - 删除分类（有子分类时会拒绝） */
exports.deleteCategory = async (req, res, next) => {
  try {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return res.status(400).json({ success: false, message: '分类ID不合法' });
    }

    const existing = await categoryModel.getById(categoryId);
    if (!existing) {
      return res.status(404).json({ success: false, message: '分类不存在' });
    }

    // 检查是否有子分类
    if (await categoryModel.hasChildren(categoryId)) {
      return res.status(409).json({ success: false, message: '该分类下存在子分类，请先删除子分类' });
    }

    await categoryModel.deleteCategory(categoryId);
    res.json({ success: true, message: '分类已删除' });
  } catch (err) {
    next(err);
  }
};

// ==================== 树形结构相关接口 ====================

/** GET /api/categories/tree - 获取整棵树（或指定根节点的树） */
exports.getTree = async (req, res, next) => {
  try {
    const rootId = req.query.rootId ? parseInt(req.query.rootId) : null;
    if (rootId !== null && isNaN(rootId)) {
      return res.status(400).json({ success: false, message: 'rootId不合法' });
    }
    const tree = await categoryModel.getTree(rootId);
    // 格式化整个树结构
    const formattedTree = tree.map(formatCategory);
    res.json({ success: true, data: formattedTree });
  } catch (err) {
    next(err);
  }
};

/** GET /api/categories/:id/children - 获取直接子分类列表 */
exports.getChildren = async (req, res, next) => {
  try {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return res.status(400).json({ success: false, message: '分类ID不合法' });
    }
    const children = await categoryModel.getChildren(categoryId);
    res.json({ success: true, data: children.map(formatCategory) });
  } catch (err) {
    next(err);
  }
};

/** GET /api/categories/:id/descendants - 获取所有后代（不包含自身） */
exports.getDescendants = async (req, res, next) => {
  try {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return res.status(400).json({ success: false, message: '分类ID不合法' });
    }
    const includeSelf = req.query.includeSelf === 'true';
    const descendants = await categoryModel.getDescendants(categoryId, includeSelf);
    res.json({ success: true, data: descendants.map(formatCategory) });
  } catch (err) {
    next(err);
  }
};

/** GET /api/categories/:id/path - 获取从根到当前分类的路径 */
exports.getPath = async (req, res, next) => {
  try {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return res.status(400).json({ success: false, message: '分类ID不合法' });
    }
    const path = await categoryModel.getPath(categoryId);
    res.json({ success: true, data: path.map(formatCategory) });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/categories/:id/move - 移动分类（修改父分类） */
exports.moveCategory = async (req, res, next) => {
  try {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return res.status(400).json({ success: false, message: '分类ID不合法' });
    }

    const { parentId } = req.body;
    if (parentId === undefined) {
      return res.status(400).json({ success: false, message: '缺少parentId参数' });
    }

    const newParentId = parentId === null ? null : parseInt(parentId);
    if (newParentId !== null && isNaN(newParentId)) {
      return res.status(400).json({ success: false, message: '父分类ID不合法' });
    }

    const existing = await categoryModel.getById(categoryId);
    if (!existing) {
      return res.status(404).json({ success: false, message: '分类不存在' });
    }

    // 检查新父分类是否存在
    if (newParentId !== null && !(await categoryModel.exists(newParentId))) {
      return res.status(404).json({ success: false, message: '父分类不存在' });
    }

    // 检查循环依赖
    const isCyclic = await categoryModel.checkCyclic(categoryId, newParentId);
    if (isCyclic) {
      return res.status(400).json({ success: false, message: '不能将分类移动到自己的子分类下，会形成循环依赖' });
    }

    await categoryModel.updateParent(categoryId, newParentId);
    const updated = await categoryModel.getById(categoryId);
    res.json({ success: true, data: formatCategory(updated) });
  } catch (err) {
    next(err);
  }
};

// ==================== 分页列表（后台管理） ====================

/** GET /api/categories?page=1&pageSize=20&parentId=xx - 分页获取分类（平铺） */
exports.listCategories = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    let { parentId } = req.query;

    if (parentId !== undefined) {
      parentId = parentId === 'null' ? null : parseInt(parentId);
      if (parentId !== null && isNaN(parentId)) {
        return res.status(400).json({ success: false, message: 'parentId参数不合法' });
      }
    }

    const result = await categoryModel.listCategories({ page, pageSize, parentId });
    result.list = result.list.map(formatCategory);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// ==================== 辅助校验接口 ====================

/** GET /api/categories/check-name?name=xxx&parentId=xxx - 检查同级名称是否可用 */
exports.checkName = async (req, res, next) => {
  try {
    const { name, parentId } = req.query;
    if (!name) {
      return res.status(400).json({ success: false, message: '缺少name参数' });
    }
    const parentIdVal = parentId !== undefined && parentId !== 'null' ? parseInt(parentId) : null;
    if (parentIdVal !== null && isNaN(parentIdVal)) {
      return res.status(400).json({ success: false, message: 'parentId不合法' });
    }
    const exists = await categoryModel.isNameUnderParentExists(name, parentIdVal);
    res.json({ success: true, data: { name, parentId: parentIdVal, available: !exists } });
  } catch (err) {
    next(err);
  }
};