// src/models/locationModel.js
const pool = require('../config/db');

// ==================== 基础查询 ====================

/** 根据地点ID获取地点信息 */
const getById = async (locationId) => {
  const [rows] = await pool.query(
    'SELECT location_id, name, latitude, longitude, description FROM location WHERE location_id = ?',
    [locationId]
  );
  return rows[0] || null;
};

/** 检查地点是否存在 */
const exists = async (locationId) => {
  const [[{ cnt }]] = await pool.query(
    'SELECT COUNT(*) as cnt FROM location WHERE location_id = ?',
    [locationId]
  );
  return cnt > 0;
};

// ==================== 创建/更新/删除 ====================

/**
 * 创建地点
 */
const create = async (name, latitude = null, longitude = null, description = null) => {
  const [result] = await pool.query(
    `INSERT INTO location (name, latitude, longitude, description)
     VALUES (?, ?, ?, ?)`,
    [name, latitude, longitude, description]
  );
  return getById(result.insertId);
};

/**
 * 更新地点
 * @param {number} locationId
 * @param {Object} data - 可包含 name, latitude, longitude, description
 */
const update = async (locationId, data) => {
  const updates = [];
  const values = [];
  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }
  if (data.latitude !== undefined) {
    updates.push('latitude = ?');
    values.push(data.latitude);
  }
  if (data.longitude !== undefined) {
    updates.push('longitude = ?');
    values.push(data.longitude);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    values.push(data.description);
  }
  if (updates.length === 0) return;
  values.push(locationId);
  await pool.query(`UPDATE location SET ${updates.join(', ')} WHERE location_id = ?`, values);
};

/**
 * 删除地点
 */
const deleteLocation = async (locationId) => {
  await pool.query('DELETE FROM location WHERE location_id = ?', [locationId]);
};

// ==================== 分页列表 ====================

/**
 * 获取地点列表（分页，支持关键词搜索）
 */
const listLocations = async ({ page = 1, pageSize = 20, keyword } = {}) => {
  const conditions = [];
  const values = [];

  if (keyword) {
    conditions.push('(name LIKE ? OR description LIKE ?)');
    values.push(`%${keyword}%`, `%${keyword}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;

  const [rows] = await pool.query(
    `SELECT location_id, name, latitude, longitude, description
     FROM location ${whereClause}
     ORDER BY location_id DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  );

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM location ${whereClause}`,
    values
  );

  return {
    list: rows,
    total,
    page,
    pageSize,
  };
};

module.exports = {
  getById,
  exists,
  create,
  update,
  deleteLocation,
  listLocations,
};