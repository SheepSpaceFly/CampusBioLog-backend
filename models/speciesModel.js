// src/models/speciesModel.js
const pool = require('../config/db');

// ==================== 基础查询 ====================

/**
 * 根据物种ID获取物种信息
 */
const getById = async (speciesId) => {
  const query = `
    SELECT species_id, species_name, description, created_at
    FROM species
    WHERE species_id = ?
  `;
  const [rows] = await pool.query(query, [speciesId]);
  return rows[0] || null;
};

/**
 * 检查物种是否存在
 */
const exists = async (speciesId) => {
  const [[{ cnt }]] = await pool.query(
    'SELECT COUNT(*) as cnt FROM species WHERE species_id = ?',
    [speciesId]
  );
  return cnt > 0;
};

// ==================== 创建物种 ====================

/**
 * 创建物种，返回新创建的物种
 */
const create = async (data) => {
  const { species_name, description } = data;
  const [result] = await pool.query(
    `INSERT INTO species (species_name, description)
     VALUES (?, ?)`,
    [species_name, description || null]
  );
  return getById(result.insertId);
};

// ==================== 更新物种 ====================

/**
 * 更新物种信息
 */
const update = async (speciesId, data) => {
  const updates = [];
  const values = [];
  if (data.species_name !== undefined) {
    updates.push('species_name = ?');
    values.push(data.species_name);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    values.push(data.description);
  }
  if (updates.length === 0) return;
  values.push(speciesId);
  await pool.query(`UPDATE species SET ${updates.join(', ')} WHERE species_id = ?`, values);
};

// ==================== 删除物种 ====================

const deleteSpecies = async (speciesId) => {
  await pool.query('DELETE FROM species WHERE species_id = ?', [speciesId]);
};

// ==================== 列表查询（分页+筛选） ====================

/**
 * 获取物种列表
 */
const listSpecies = async ({ page = 1, pageSize = 20, keyword } = {}) => {
  const conditions = [];
  const values = [];

  if (keyword) {
    conditions.push('species_name LIKE ?');
    values.push(`%${keyword}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;

  const [rows] = await pool.query(
    `SELECT species_id, species_name, description, created_at
     FROM species
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  );

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM species ${whereClause}`,
    values
  );

  return { list: rows, total, page, pageSize };
};

// ==================== 工具方法 ====================

/**
 * 检查物种名称是否已存在（全局唯一）
 */
const isSpeciesNameExists = async (speciesName, excludeId = null) => {
  let sql = 'SELECT COUNT(*) as cnt FROM species WHERE species_name = ?';
  const params = [speciesName];
  if (excludeId !== null) {
    sql += ' AND species_id != ?';
    params.push(excludeId);
  }
  const [[{ cnt }]] = await pool.query(sql, params);
  return cnt > 0;
};

const isSpeciesExists = async (speciesId) => {
  return exists(speciesId);
};

module.exports = {
  getById,
  exists,
  create,
  update,
  deleteSpecies,
  listSpecies,
  isSpeciesNameExists,
  isSpeciesExists,
};