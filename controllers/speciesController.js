// src/controllers/speciesController.js
const speciesModel = require('../models/speciesModel');
const { formatSpecies } = require('../utils/format');

// ==================== CRUD 基础操作 ====================

/** GET /api/species/:id - 获取单个物种 */
exports.getSpeciesById = async (req, res, next) => {
  try {
    const speciesId = parseInt(req.params.id);
    if (isNaN(speciesId)) {
      return res.status(400).json({ success: false, message: '物种ID不合法' });
    }
    const species = await speciesModel.getById(speciesId);
    if (!species) {
      return res.status(404).json({ success: false, message: '物种不存在' });
    }
    res.json({ success: true, data: formatSpecies(species) });
  } catch (err) {
    next(err);
  }
};

/** POST /api/species - 创建物种 */
exports.createSpecies = async (req, res, next) => {
  try {
    const { speciesName, description } = req.body;

    if (!speciesName || speciesName.trim() === '') {
      return res.status(400).json({ success: false, message: '物种名称不能为空' });
    }

    // 检查名称是否已存在
    const nameExists = await speciesModel.isSpeciesNameExists(speciesName);
    if (nameExists) {
      return res.status(409).json({ success: false, message: '物种名称已存在' });
    }

    const newSpecies = await speciesModel.create({
      species_name: speciesName,
      description: description || null,
    });
    res.status(201).json({ success: true, data: formatSpecies(newSpecies) });
  } catch (err) {
    next(err);
  }
};

/** PUT /api/species/:id - 更新物种信息 */
exports.updateSpecies = async (req, res, next) => {
  try {
    const speciesId = parseInt(req.params.id);
    if (isNaN(speciesId)) {
      return res.status(400).json({ success: false, message: '物种ID不合法' });
    }

    const existing = await speciesModel.getById(speciesId);
    if (!existing) {
      return res.status(404).json({ success: false, message: '物种不存在' });
    }

    const { speciesName, description } = req.body;
    const updateData = {};

    // 处理名称更新
    if (speciesName !== undefined) {
      if (!speciesName.trim()) {
        return res.status(400).json({ success: false, message: '物种名称不能为空' });
      }
      // 检查新名称是否与其他物种冲突
      if (speciesName !== existing.species_name) {
        const nameExists = await speciesModel.isSpeciesNameExists(speciesName, speciesId);
        if (nameExists) {
          return res.status(409).json({ success: false, message: '物种名称已存在' });
        }
      }
      updateData.species_name = speciesName;
    }

    // 处理描述更新
    if (description !== undefined) {
      updateData.description = description || null;
    }

    await speciesModel.update(speciesId, updateData);
    const updated = await speciesModel.getById(speciesId);
    res.json({ success: true, data: formatSpecies(updated) });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/species/:id - 删除物种 */
exports.deleteSpecies = async (req, res, next) => {
  try {
    const speciesId = parseInt(req.params.id);
    if (isNaN(speciesId)) {
      return res.status(400).json({ success: false, message: '物种ID不合法' });
    }
    const exists = await speciesModel.exists(speciesId);
    if (!exists) {
      return res.status(404).json({ success: false, message: '物种不存在' });
    }
    await speciesModel.deleteSpecies(speciesId);
    res.json({ success: true, message: '物种已删除' });
  } catch (err) {
    next(err);
  }
};

// ==================== 列表查询 ====================

/** GET /api/species - 获取物种列表（支持 keyword 筛选） */
exports.listSpecies = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const { keyword } = req.query;

    const result = await speciesModel.listSpecies({
      page,
      pageSize,
      keyword: keyword || undefined,
    });
    result.list = result.list.map(formatSpecies);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// ==================== 辅助校验接口 ====================

/** GET /api/species/check-name?speciesName=xxx */
exports.checkSpeciesName = async (req, res, next) => {
  try {
    const { speciesName } = req.query;
    if (!speciesName) {
      return res.status(400).json({ success: false, message: '缺少 speciesName 参数' });
    }
    const exists = await speciesModel.isSpeciesNameExists(speciesName);
    res.json({ success: true, data: { speciesName, available: !exists } });
  } catch (err) {
    next(err);
  }
};