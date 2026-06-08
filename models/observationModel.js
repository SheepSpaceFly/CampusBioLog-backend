// src/models/observationModel.js
const pool = require('../config/db');

// ==================== 私有辅助：联查观测记录及关联对象 ====================
/**
 * 执行观测记录的联查 SQL（用于 getById / list 等）
 * @param {string} whereClause - WHERE 条件（占位符形式）
 * @param {Array} values - 参数值
 * @param {string} orderBy - 排序，默认 'o.obs_id DESC'
 * @param {string} limitOffset - LIMIT ?, ? 占位符（可选）
 * @returns {Promise<Array>} 联查结果行（扁平）
 */
const _queryObservations = async (whereClause = '1=1', values = [], orderBy = 'o.obs_id DESC', limitOffset = '') => {
  const sql = `
    SELECT 
      o.obs_id, o.user_id, o.species_id, o.location_id, o.content,
      o.status, o.submitted_at, o.reviewed_at, o.identified_at,
      u.user_id AS u_user_id, u.username, u.role AS u_role, u.status AS u_status,
      u.nickname, u.avatar_url,
      s.species_id AS s_species_id, s.species_name,
      s.description AS species_description, s.created_at AS species_created_at,
      l.location_id AS l_location_id, l.name AS location_name,
      l.latitude, l.longitude, l.description AS location_description
    FROM observation o
    LEFT JOIN user u ON o.user_id = u.user_id
    LEFT JOIN species s ON o.species_id = s.species_id
    LEFT JOIN location l ON o.location_id = l.location_id
    WHERE ${whereClause}
    ORDER BY ${orderBy}
    ${limitOffset}
  `;
  const [rows] = await pool.query(sql, values);
  return rows;
};

// ==================== 基础查询 ====================

/**
 * 根据观测记录 ID 获取完整信息（含 user, species, location）
 */
const getById = async (obsId) => {
  const rows = await _queryObservations('o.obs_id = ?', [obsId]);
  return rows[0] || null;
};

/**
 * 获取某个用户的所有观测记录
 */
const getByUserId = async (userId, { page = 1, pageSize = 20 } = {}) => {
  const offset = (page - 1) * pageSize;
  const rows = await _queryObservations(
    'o.user_id = ?',
    [userId, pageSize, offset],          
    'o.obs_id DESC',
    'LIMIT ? OFFSET ?'             
  );
  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) as total FROM observation WHERE user_id = ?',
    [userId]
  );
  return { list: rows, total, page, pageSize };
};

/**
 * 获取观测记录列表（支持分页和多条件筛选）
 * @param {Object} filters - { page, pageSize, userId, speciesId, locationId, status, keyword }
 */
const listObservations = async ({ page = 1, pageSize = 20, userId, speciesId, locationId, status, keyword } = {}) => {
  const conditions = [];
  const values = [];

  if (userId) {
    conditions.push('o.user_id = ?');
    values.push(userId);
  }
  if (speciesId) {
    conditions.push('o.species_id = ?');
    values.push(speciesId);
  }
  if (locationId) {
    conditions.push('o.location_id = ?');
    values.push(locationId);
  }
  if (status) {
    conditions.push('o.status = ?');
    values.push(status);
  }
  if (keyword) {
    conditions.push('o.content LIKE ?');
    values.push(`%${keyword}%`);
  }

  const whereClause = conditions.length ? conditions.join(' AND ') : '1=1';
  const offset = (page - 1) * pageSize;
  
  // ✅ 复制 values 并追加分页参数
  const rows = await _queryObservations(
    whereClause,
    [...values, pageSize, offset],        // ✅ 合并分页参数
    'o.obs_id DESC',
    'LIMIT ? OFFSET ?'
  );

  const countSql = `SELECT COUNT(*) as total FROM observation o WHERE ${whereClause}`;
  const [[{ total }]] = await pool.query(countSql, values); // 注意 count 不需要分页参数

  return { list: rows, total, page, pageSize };
};

/**
 * 检查观测记录是否存在
 */
const exists = async (obsId) => {
  const [[{ cnt }]] = await pool.query(
    'SELECT COUNT(*) as cnt FROM observation WHERE obs_id = ?',
    [obsId]
  );
  return cnt > 0;
};

/**
 * 获取观测记录的所有者ID（用于权限校验）
 */
const getOwnerId = async (obsId) => {
  const [[{ user_id }]] = await pool.query(
    'SELECT user_id FROM observation WHERE obs_id = ?',
    [obsId]
  );
  return user_id || null;
};

// ==================== 写入操作 ====================

/**
 * 创建观测记录
 * @param {Object} data - { user_id, species_id, location_id, content, status }
 */
const createObservation = async ({ user_id, species_id = null, location_id, content = null, status = 'pending_review' }) => {
  const [result] = await pool.query(
    `INSERT INTO observation
      (user_id, species_id, location_id, content, status)
     VALUES (?, ?, ?, ?, ?)`,
    [user_id, species_id, location_id, content, status]
  );
  return { obs_id: result.insertId };
};

/**
 * 更新观测记录（仅更新允许的字段）
 * @param {number} obsId
 * @param {Object} updateData - 可包含 species_id, location_id, content, status
 */
const updateObservation = async (obsId, updateData) => {
  const updates = [];
  const values = [];
  if (updateData.species_id !== undefined) {
    updates.push('species_id = ?');
    values.push(updateData.species_id);
  }
  if (updateData.location_id !== undefined) {
    updates.push('location_id = ?');
    values.push(updateData.location_id);
  }
  if (updateData.content !== undefined) {
    updates.push('content = ?');
    values.push(updateData.content);
  }
  if (updateData.status !== undefined) {
    updates.push('status = ?');
    values.push(updateData.status);
  }
  if (updates.length === 0) return;
  values.push(obsId);
  await pool.query(
    `UPDATE observation SET ${updates.join(', ')} WHERE obs_id = ?`,
    values
  );
};

/**
 * 更新观测记录的状态（审核流程专用）
 * @param {number} obsId
 * @param {string} status - pending_review, approved, rejected, needs_identification, identified
 * @param {string} reviewedAt - 可传，不传则自动设为当前时间（如果是 approved/rejected）
 */
const updateStatus = async (obsId, status, reviewedAt = null) => {
  let reviewedField = '';
  let identifiedField = '';
  let values = [status];
  if (status === 'approved' || status === 'rejected') {
    reviewedField = ', reviewed_at = ?';
    values.push(reviewedAt || new Date());
  }
  if (status === 'identified') {
    identifiedField = ', identified_at = ?';
    values.push(reviewedAt || new Date());
  }
  values.push(obsId);
  await pool.query(
    `UPDATE observation SET status = ?${reviewedField}${identifiedField} WHERE obs_id = ?`,
    values
  );
};

/**
 * 删除观测记录（硬删除，外键级联删除照片）
 */
const deleteObservation = async (obsId) => {
  await pool.query('DELETE FROM observation WHERE obs_id = ?', [obsId]);
};

// ==================== 统计类工具 ====================

/**
 * 获取用户观测记录数量
 */
const countByUser = async (userId) => {
  const [[{ cnt }]] = await pool.query(
    'SELECT COUNT(*) as cnt FROM observation WHERE user_id = ?',
    [userId]
  );
  return cnt;
};

/**
 * 获取物种被观测次数
 */
const countBySpecies = async (speciesId) => {
  const [[{ cnt }]] = await pool.query(
    'SELECT COUNT(*) as cnt FROM observation WHERE species_id = ?',
    [speciesId]
  );
  return cnt;
};

// ==================== 观测照片相关 ====================

/**
 * 批量创建照片记录
 * @param {Array} photos - [{ obs_id, file_path, preview_path }]
 */
const createPhotos = async (photos) => {
  if (!photos.length) return [];
  const values = photos.map(p => [p.obs_id, p.file_path, p.preview_path]);
  const [result] = await pool.query(
    `INSERT INTO observation_photo (obs_id, file_path, preview_path) VALUES ?`,
    [values]
  );
  return photos.map((p, idx) => ({
    photo_id: result.insertId + idx,
    obs_id: p.obs_id,
    file_path: p.file_path,
    preview_path: p.preview_path,
    uploaded_at: new Date()
  }));
};

/**
 * 获取某观测的所有照片记录
 */
const getPhotosByObsId = async (obs_id) => {
  const [rows] = await pool.query(
    `SELECT photo_id, obs_id, file_path, preview_path, uploaded_at
     FROM observation_photo WHERE obs_id = ? ORDER BY photo_id ASC`,
    [obs_id]
  );
  return rows;
};

/**
 * 获取单张照片信息
 */
const getPhotoById = async (photo_id) => {
  const [rows] = await pool.query(
    `SELECT photo_id, obs_id, file_path, preview_path, uploaded_at FROM observation_photo WHERE photo_id = ?`,
    [photo_id]
  );
  return rows[0];
};

/**
 * 删除单张照片记录（仅数据库）
 */
const deletePhotoRecord = async (photo_id) => {
  await pool.query('DELETE FROM observation_photo WHERE photo_id = ?', [photo_id]);
};

/**
 * 删除观测关联的所有照片记录（用于级联删除）
 */
const deletePhotosByObsId = async (obs_id) => {
  await pool.query('DELETE FROM observation_photo WHERE obs_id = ?', [obs_id]);
};

module.exports = {
  getById,
  getByUserId,
  listObservations,
  exists,
  getOwnerId,
  createObservation,
  updateObservation,
  updateStatus,
  deleteObservation,
  countByUser,
  countBySpecies,
  createPhotos,
  getPhotosByObsId,
  getPhotoById,
  deletePhotoRecord,
  deletePhotosByObsId
};