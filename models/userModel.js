// src/models/userModel.js
const pool = require('../config/db');

// ==================== 基础查询 ====================

/** 根据用户ID获取用户信息 */
const getById = async (userId) => {
  const [rows] = await pool.query(
    'SELECT * FROM user WHERE user_id = ?',
    [userId]
  );
  return rows[0];
};

/** 根据微信 openid 获取用户 */
const getByOpenId = async (openid) => {
  const [rows] = await pool.query(
    'SELECT * FROM user WHERE wechat_openid = ?',
    [openid]
  );
  return rows[0];
};

/** 根据用户名查找（管理员登录用） */
const getByUsername = async (username) => {
  const [rows] = await pool.query(
    'SELECT * FROM user WHERE username = ?',
    [username]
  );
  return rows[0];
};

/** 根据邮箱查找（管理员登录用） */
const getByEmail = async (email) => {
  const [rows] = await pool.query(
    'SELECT * FROM user WHERE email = ?',
    [email]
  );
  return rows[0];
};

// ==================== 创建用户 ====================

/**
 * 创建微信用户（普通用户）
 * @param {string} openid - 微信 openid
 * @param {string} [nickname] - 昵称
 * @param {string} [avatarUrl] - 头像地址
 */
const createWechatUser = async (openid, nickname = null, avatarUrl = null) => {
  const [result] = await pool.query(
    `INSERT INTO user (wechat_openid, nickname, avatar_url, role, status)
     VALUES (?, ?, ?, 'observer', 'active')`,
    [openid, nickname, avatarUrl]
  );
  return { user_id: result.insertId, nickname, avatar_url: avatarUrl, role: 'observer' };
};

/**
 * 创建管理员账号
 * @param {string} username - 用户名
 * @param {string} email - 邮箱
 * @param {string} passwordHash - 加密后的密码
 * @param {string} [role='admin'] - 角色，admin 或 reviewer
 * @param {string} [avatarUrl=null] - 头像地址
 */
const createAdmin = async (username, email, passwordHash, role = 'admin', avatarUrl = null) => {
  const [result] = await pool.query(
    `INSERT INTO user (username, email, password_hash, role, status, avatar_url)
     VALUES (?, ?, ?, ?, 'active', ?)`,
    [username, email, passwordHash, role, avatarUrl]
  );
  return {
    user_id: result.insertId,
    username,
    email,
    role,
    avatar_url: avatarUrl,
  };
};

// ==================== 更新用户信息 ====================

/** 更新微信用户的公开信息（昵称、头像） */
const updateWechatProfile = async (userId, nickname, avatarUrl) => {
  await pool.query(
    'UPDATE user SET nickname = ?, avatar_url = ? WHERE user_id = ?',
    [nickname, avatarUrl, userId]
  );
};

/** 更新管理员资料（用户名、邮箱、密码哈希） */
const updateAdminProfile = async (userId, { username, email, passwordHash }) => {
  // 动态构造更新字段，避免覆盖不需要改的字段
  const updates = [];
  const values = [];
  if (username !== undefined) { updates.push('username = ?'); values.push(username); }
  if (email !== undefined) { updates.push('email = ?'); values.push(email); }
  if (passwordHash !== undefined) { updates.push('password_hash = ?'); values.push(passwordHash); }
  if (updates.length === 0) return;
  values.push(userId);
  await pool.query(`UPDATE user SET ${updates.join(', ')} WHERE user_id = ?`, values);
};

/** 更新用户状态（active / banned） */
const updateStatus = async (userId, status) => {
  await pool.query(
    'UPDATE user SET status = ? WHERE user_id = ?',
    [status, userId]
  );
};

/** 更新用户角色（observer / reviewer / admin） */
const updateRole = async (userId, role) => {
  await pool.query(
    'UPDATE user SET role = ? WHERE user_id = ?',
    [role, userId]
  );
};

/** 更新最后登录时间 */
const updateLastLogin = async (userId) => {
  await pool.query(
    'UPDATE user SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = ?',
    [userId]
  );
};

// ==================== 列表查询（后台使用） ====================

/**
 * 获取用户列表（支持分页和筛选）
 * @param {Object} options - { page, pageSize, role, status, keyword }
 */
const listUsers = async ({ page = 1, pageSize = 20, role, status, keyword } = {}) => {
  const conditions = [];
  const values = [];

  if (role) {
    conditions.push('role = ?');
    values.push(role);
  }
  if (status) {
    conditions.push('status = ?');
    values.push(status);
  }
  if (keyword) {
    // 按昵称或用户名模糊搜索
    conditions.push('(nickname LIKE ? OR username LIKE ?)');
    values.push(`%${keyword}%`, `%${keyword}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;

  const [rows] = await pool.query(
    `SELECT user_id, username, email, wechat_openid, role, status, nickname, avatar_url, created_at, last_login_at
     FROM user ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  );

  // 查询总数用于分页
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM user ${whereClause}`,
    values
  );

  return {
    list: rows,
    total,
    page,
    pageSize,
  };
};

// ==================== 删除用户 ====================

/** 删除用户（硬删除，慎用） */
const deleteUser = async (userId) => {
  await pool.query('DELETE FROM user WHERE user_id = ?', [userId]);
};

// ==================== 工具方法 ====================

/** 检查用户名是否已存在 */
const isUsernameTaken = async (username) => {
  const [[{ cnt }]] = await pool.query(
    'SELECT COUNT(*) as cnt FROM user WHERE username = ?',
    [username]
  );
  return cnt > 0;
};

/** 检查邮箱是否已存在 */
const isEmailTaken = async (email) => {
  const [[{ cnt }]] = await pool.query(
    'SELECT COUNT(*) as cnt FROM user WHERE email = ?',
    [email]
  );
  return cnt > 0;
};

/** 检查 openid 是否已存在 */
const isOpenIdExists = async (openid) => {
  const [[{ cnt }]] = await pool.query(
    'SELECT COUNT(*) as cnt FROM user WHERE wechat_openid = ?',
    [openid]
  );
  return cnt > 0;
};

module.exports = {
  getById,
  getByOpenId,
  getByUsername,
  getByEmail,
  createWechatUser,
  createAdmin,
  updateWechatProfile,
  updateAdminProfile,
  updateStatus,
  updateRole,
  updateLastLogin,
  listUsers,
  deleteUser,
  isUsernameTaken,
  isEmailTaken,
  isOpenIdExists,
};