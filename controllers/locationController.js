// src/controllers/locationController.js
const locationModel = require('../models/locationModel');
const { formatLocation } = require('../utils/format');

// ==================== CRUD 基础操作 ====================

/** GET /api/locations/:id - 获取单个地点 */
exports.getLocationById = async (req, res, next) => {
  try {
    const locationId = parseInt(req.params.id);
    if (isNaN(locationId)) {
      return res.status(400).json({ success: false, message: '地点ID不合法' });
    }
    const location = await locationModel.getById(locationId);
    if (!location) {
      return res.status(404).json({ success: false, message: '地点不存在' });
    }
    res.json({ success: true, data: formatLocation(location) });
  } catch (err) {
    next(err);
  }
};

/** POST /api/locations - 创建地点 */
exports.createLocation = async (req, res, next) => {
  try {
    const { name, latitude, longitude, description } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: '地点名称不能为空' });
    }

    // 经纬度校验（如果提供）
    let latVal = null, lngVal = null;
    if (latitude !== undefined && latitude !== null) {
      latVal = parseFloat(latitude);
      if (isNaN(latVal) || latVal < -90 || latVal > 90) {
        return res.status(400).json({ success: false, message: '纬度值无效，范围应在 -90 到 90 之间' });
      }
    }
    if (longitude !== undefined && longitude !== null) {
      lngVal = parseFloat(longitude);
      if (isNaN(lngVal) || lngVal < -180 || lngVal > 180) {
        return res.status(400).json({ success: false, message: '经度值无效，范围应在 -180 到 180 之间' });
      }
    }

    const newLocation = await locationModel.create(name, latVal, lngVal, description || null);
    res.status(201).json({ success: true, data: formatLocation(newLocation) });
  } catch (err) {
    next(err);
  }
};

/** PUT /api/locations/:id - 更新地点 */
exports.updateLocation = async (req, res, next) => {
  try {
    const locationId = parseInt(req.params.id);
    if (isNaN(locationId)) {
      return res.status(400).json({ success: false, message: '地点ID不合法' });
    }

    const existing = await locationModel.getById(locationId);
    if (!existing) {
      return res.status(404).json({ success: false, message: '地点不存在' });
    }

    const { name, latitude, longitude, description } = req.body;
    const updateData = {};

    // 处理名称更新
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ success: false, message: '地点名称不能为空' });
      }
      updateData.name = name;
    }

    // 处理经纬度
    if (latitude !== undefined) {
      const latVal = latitude === null ? null : parseFloat(latitude);
      if (latVal !== null && (isNaN(latVal) || latVal < -90 || latVal > 90)) {
        return res.status(400).json({ success: false, message: '纬度值无效，范围应在 -90 到 90 之间' });
      }
      updateData.latitude = latVal;
    }
    if (longitude !== undefined) {
      const lngVal = longitude === null ? null : parseFloat(longitude);
      if (lngVal !== null && (isNaN(lngVal) || lngVal < -180 || lngVal > 180)) {
        return res.status(400).json({ success: false, message: '经度值无效，范围应在 -180 到 180 之间' });
      }
      updateData.longitude = lngVal;
    }

    // 处理描述
    if (description !== undefined) {
      updateData.description = description || null;
    }

    await locationModel.update(locationId, updateData);
    const updated = await locationModel.getById(locationId);
    res.json({ success: true, data: formatLocation(updated) });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/locations/:id - 删除地点 */
exports.deleteLocation = async (req, res, next) => {
  try {
    const locationId = parseInt(req.params.id);
    if (isNaN(locationId)) {
      return res.status(400).json({ success: false, message: '地点ID不合法' });
    }

    const existing = await locationModel.getById(locationId);
    if (!existing) {
      return res.status(404).json({ success: false, message: '地点不存在' });
    }

    await locationModel.deleteLocation(locationId);
    res.json({ success: true, message: '地点已删除' });
  } catch (err) {
    next(err);
  }
};

// ==================== 分页列表（后台管理） ====================

/** GET /api/locations?page=1&pageSize=20&keyword=xx - 分页获取地点 */
exports.listLocations = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const { keyword } = req.query;

    const result = await locationModel.listLocations({ page, pageSize, keyword });
    result.list = result.list.map(formatLocation);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};