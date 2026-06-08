// src/controllers/userController.js
const userModel = require('../models/userModel');
const { formatUser } = require('../utils/format');
const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');

const DEFAULT_AVATAR = '/uploads/avatar/default_avatar.png';

// ==================== 获取用户信息 ====================

/** GET /api/users/:id - 通过 ID 获取用户 */
exports.getUserById = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: '用户ID不合法' });
    }
    const user = await userModel.getById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    res.json({ success: true, data: formatUser(user) });
  } catch (err) {
    next(err);
  }
};

/** GET /api/users?openid=xxx - 通过 openid 获取用户（常用于微信登录） */
exports.getUserByOpenId = async (req, res, next) => {
  try {
    const { openid } = req.query;
    if (!openid) {
      return res.status(400).json({ success: false, message: '缺少 openid 参数' });
    }
    const user = await userModel.getByOpenId(openid);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    res.json({ success: true, data: formatUser(user) });
  } catch (err) {
    next(err);
  }
};

// ==================== 创建用户 ====================

/** POST /api/users/wechat - 微信用户注册/登录（需要 openid） */
exports.createWechatUser = async (req, res, next) => {
  try {
    const { openid, nickname, avatarUrl } = req.body;
    if (!openid) {
      return res.status(400).json({ success: false, message: '缺少 openid' });
    }
    const exists = await userModel.isOpenIdExists(openid);
    if (exists) {
      return res.status(409).json({ success: false, message: '该微信用户已存在' });
    }
    // 若未提供头像 URL 或为空，使用默认头像
    const finalAvatar = avatarUrl && avatarUrl.trim() !== '' ? avatarUrl : DEFAULT_AVATAR;
    const newUser = await userModel.createWechatUser(openid, nickname, finalAvatar);
    res.status(201).json({ success: true, data: formatUser(newUser) });
  } catch (err) {
    next(err);
  }
};

/** POST /api/users/admin - 创建管理员账号（由管理员操作） */
exports.createAdmin = async (req, res, next) => {
  try {
    const { username, email, password, role, avatarUrl } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: '用户名、邮箱和密码不能为空' });
    }
    if (await userModel.isUsernameTaken(username)) {
      return res.status(409).json({ success: false, message: '用户名已存在' });
    }
    if (await userModel.isEmailTaken(email)) {
      return res.status(409).json({ success: false, message: '邮箱已存在' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const finalAvatar = avatarUrl && avatarUrl.trim() !== '' ? avatarUrl : DEFAULT_AVATAR;
    const newAdmin = await userModel.createAdmin(username, email, passwordHash, role || 'admin', finalAvatar);
    res.status(201).json({ success: true, data: formatUser(newAdmin) });
  } catch (err) {
    next(err);
  }
};

// ==================== 更新用户资料 ====================

/** PUT /api/users/:id/profile - 微信用户修改昵称头像 */
exports.updateWechatProfile = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: '用户ID不合法' });
    }
    const { nickname, avatarUrl } = req.body;
    // 至少提供一个字段
    if (nickname === undefined && avatarUrl === undefined) {
      return res.status(400).json({ success: false, message: '至少需要提供昵称或头像' });
    }
    await userModel.updateWechatProfile(userId, nickname, avatarUrl);
    // 返回更新后的用户
    const updated = await userModel.getById(userId);
    res.json({ success: true, data: formatUser(updated) });
  } catch (err) {
    next(err);
  }
};

/** PUT /api/users/:id/admin - 管理员修改自己的资料（用户名、邮箱、密码） */
exports.updateAdminProfile = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: '用户ID不合法' });
    }
    const { username, email, password } = req.body;
    // 校验唯一性（如果修改了用户名/邮箱）
    if (username) {
      const existing = await userModel.getByUsername(username);
      if (existing && existing.user_id !== userId) {
        return res.status(409).json({ success: false, message: '用户名已被占用' });
      }
    }
    if (email) {
      const existing = await userModel.getByEmail(email);
      if (existing && existing.user_id !== userId) {
        return res.status(409).json({ success: false, message: '邮箱已被占用' });
      }
    }
    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (password) updateData.passwordHash = await bcrypt.hash(password, 10);
    await userModel.updateAdminProfile(userId, updateData);
    const updated = await userModel.getById(userId);
    res.json({ success: true, data: formatUser(updated) });
  } catch (err) {
    next(err);
  }
};

// ==================== 头像上传与更新（新增） ====================
/** POST /api/users/:id/avatar - 上传/更新头像（multipart/form-data，字段名 avatar） */
exports.updateAvatar = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: '用户ID不合法' });
    }

    // 获取当前用户信息
    const user = await userModel.getById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 权限：只允许用户自己修改头像（或管理员，这里简化，由上层路由中间件决定）
    const { userId: reqUserId } = req.body; // 可从 JWT 或 body 中获取请求者ID
    if (parseInt(reqUserId) !== userId) {
      return res.status(403).json({ success: false, message: '无权修改他人头像' });
    }

    // 检查是否有文件上传
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择图片文件' });
    }

    // 新文件的相对路径
    const newAvatarRelative = `/uploads/avatar/${req.file.filename}`;

    // 更新数据库中的 avatar_url
    await userModel.updateWechatProfile(userId, user.nickname, newAvatarRelative);

    // 删除旧头像（如果不是默认头像）
    if (user.avatar_url && user.avatar_url !== DEFAULT_AVATAR) {
      await deleteFile(user.avatar_url);
    }

    // 返回更新后的用户信息
    const updatedUser = await userModel.getById(userId);
    res.json({ success: true, data: formatUser(updatedUser) });
  } catch (err) {
    // 出错时尝试删除已上传的文件
    if (req.file) {
      await deleteFile(`/uploads/avatar/${req.file.filename}`).catch(() => {});
    }
    next(err);
  }
};

// ==================== 管理员操作：状态、角色 ====================

/** PATCH /api/users/:id/status - 修改用户状态（active/banned） */
exports.updateUserStatus = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: '用户ID不合法' });
    }
    const { status } = req.body;
    if (!['active', 'banned'].includes(status)) {
      return res.status(400).json({ success: false, message: '状态值只能是 active 或 banned' });
    }
    await userModel.updateStatus(userId, status);
    const updated = await userModel.getById(userId);
    res.json({ success: true, data: formatUser(updated) });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/users/:id/role - 修改用户角色 */
exports.updateUserRole = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: '用户ID不合法' });
    }
    const { role } = req.body;
    if (!['observer', 'reviewer', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: '无效的角色值' });
    }
    await userModel.updateRole(userId, role);
    const updated = await userModel.getById(userId);
    res.json({ success: true, data: formatUser(updated) });
  } catch (err) {
    next(err);
  }
};

// ==================== 用户列表（管理员） ====================

/** GET /api/users - 获取用户列表（分页+筛选） */
exports.listUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const { role, status, keyword } = req.query;

    const result = await userModel.listUsers({ page, pageSize, role, status, keyword });
    // 格式化列表里的每个用户
    result.list = result.list.map(formatUser);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// ==================== 删除用户 ====================

/** DELETE /api/users/:id - 删除用户（硬删除） */
exports.deleteUser = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: '用户ID不合法' });
    }
    const user = await userModel.getById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    if (user.avatar_url && user.avatar_url !== DEFAULT_AVATAR) {
      await deleteFile(user.avatar_url);
    }
    await userModel.deleteUser(userId);
    res.json({ success: true, message: '用户已删除' });
  } catch (err) {
    next(err);
  }
};

// ==================== 唯一性检查（供前端实时校验） ====================

/** GET /api/users/check-username?username=xxx */
exports.checkUsername = async (req, res, next) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ success: false, message: '缺少用户名' });
    const taken = await userModel.isUsernameTaken(username);
    res.json({ success: true, data: { username, available: !taken } });
  } catch (err) {
    next(err);
  }
};

/** GET /api/users/check-email?email=xxx */
exports.checkEmail = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, message: '缺少邮箱' });
    const taken = await userModel.isEmailTaken(email);
    res.json({ success: true, data: { email, available: !taken } });
  } catch (err) {
    next(err);
  }
};

/** GET /api/users/check-openid?openid=xxx */
exports.checkOpenId = async (req, res, next) => {
  try {
    const { openid } = req.query;
    if (!openid) return res.status(400).json({ success: false, message: '缺少 openid' });
    const exists = await userModel.isOpenIdExists(openid);
    res.json({ success: true, data: { openid, available: !exists } });
  } catch (err) {
    next(err);
  }
};

// ==================== 登录相关（示例，需要配合 JWT 等） ====================

/** POST /api/users/login - 管理员登录（用户名+密码） */
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }
    // 查找用户（可能是管理员）
    const user = await userModel.getByUsername(username);
    if (!user) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
    // 验证密码
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
    // 检查是否被封禁
    if (user.status === 'banned') {
      return res.status(403).json({ success: false, message: '账号已被封禁' });
    }
    // 更新最后登录时间
    await userModel.updateLastLogin(user.user_id);
    // 这里应该生成 JWT token 返回，暂时只返回用户信息
    res.json({ success: true, data: formatUser(user), message: '登录成功' });
  } catch (err) {
    next(err);
  }
};