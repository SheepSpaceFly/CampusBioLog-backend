// src/controllers/userController.js
const userModel = require('../models/userModel');
const { formatUser } = require('../utils/format');
const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

// 默认头像路径
const DEFAULT_AVATAR = '/uploads/avatar/default_avatar.jpg';

// 压缩头像：将上传的图片压缩为宽度500px、质量70%的JPEG，并覆盖原文件
async function compressAvatar(filePath, originalFilename) {
  const dir = path.dirname(filePath);
  const ext = path.extname(originalFilename);
  // 新文件名：原文件名去掉扩展名 + .jpg
  const baseName = path.basename(originalFilename, ext);
  const compressedName = `${baseName}.jpg`;
  const compressedPath = path.join(dir, compressedName);

  await sharp(filePath)
    .resize(500, null, { withoutEnlargement: true }) // 宽度500，高度自适应，不放大
    .jpeg({ quality: 70 })
    .toFile(compressedPath);

  // 删除原始文件
  await fs.unlink(filePath);
  // 返回压缩后的相对路径（相对于项目根目录）
  return `/uploads/avatar/${compressedName}`;
}

// 物理删除文件（相对路径）
async function deleteFile(relativePath) {
  if (!relativePath || relativePath === DEFAULT_AVATAR) return;
  const fullPath = path.join(__dirname, '../../', relativePath);
  try {
    await fs.unlink(fullPath);
  } catch (err) {
    console.error('头像文件删除失败', fullPath, err);
  }
}

// ==================== 获取用户信息 ====================
exports.getUserById = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: '用户ID不合法' });
    const user = await userModel.getById(userId);
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
    res.json({ success: true, data: formatUser(user) });
  } catch (err) { next(err); }
};

exports.getUserByOpenId = async (req, res, next) => {
  try {
    const { openid } = req.query;
    if (!openid) return res.status(400).json({ success: false, message: '缺少 openid 参数' });
    const user = await userModel.getByOpenId(openid);
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
    res.json({ success: true, data: formatUser(user) });
  } catch (err) { next(err); }
};

// ==================== 创建用户（支持头像压缩） ====================
/**
 * POST /api/users/wechat
 * Content-Type: multipart/form-data
 * 字段: openid (必填), nickname (可选), avatar (文件, 可选)
 */
exports.createWechatUser = async (req, res, next) => {
  try {
    const { openid, nickname } = req.body;
    if (!openid) return res.status(400).json({ success: false, message: '缺少 openid' });

    const exists = await userModel.isOpenIdExists(openid);
    if (exists) return res.status(409).json({ success: false, message: '该微信用户已存在' });

    let avatarUrl = DEFAULT_AVATAR;
    if (req.file) {
      // 压缩头像并获取最终路径
      const originalPath = req.file.path; // multer 存储的完整路径
      avatarUrl = await compressAvatar(originalPath, req.file.filename);
    }

    const newUser = await userModel.createWechatUser(openid, nickname || null, avatarUrl);
    res.status(201).json({ success: true, data: formatUser(newUser) });
  } catch (err) {
    // 若出错且已上传文件，尝试删除（压缩函数已可能删除原文件，这里再清理一下残留）
    if (req.file) {
      await deleteFile(`/uploads/avatar/${req.file.filename}`).catch(() => {});
    }
    next(err);
  }
};

/**
 * POST /api/users/admin
 * Content-Type: multipart/form-data
 * 字段: username, email, password, role (可选, 默认 admin), avatar (文件, 可选)
 */
exports.createAdmin = async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;
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
    let avatarUrl = DEFAULT_AVATAR;
    if (req.file) {
      const originalPath = req.file.path;
      avatarUrl = await compressAvatar(originalPath, req.file.filename);
    }

    const newAdmin = await userModel.createAdmin(username, email, passwordHash, role || 'admin', avatarUrl);
    res.status(201).json({ success: true, data: formatUser(newAdmin) });
  } catch (err) {
    if (req.file) {
      await deleteFile(`/uploads/avatar/${req.file.filename}`).catch(() => {});
    }
    next(err);
  }
};

// ==================== 更新用户资料（不含头像） ====================
exports.updateWechatProfile = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: '用户ID不合法' });
    const { nickname, avatarUrl } = req.body; // avatarUrl 可以是前端直接传的 URL，一般不用
    if (nickname === undefined && avatarUrl === undefined) {
      return res.status(400).json({ success: false, message: '至少需要提供昵称或头像' });
    }
    await userModel.updateWechatProfile(userId, nickname, avatarUrl);
    const updated = await userModel.getById(userId);
    res.json({ success: true, data: formatUser(updated) });
  } catch (err) { next(err); }
};

exports.updateAdminProfile = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: '用户ID不合法' });
    const { username, email, password } = req.body;
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
  } catch (err) { next(err); }
};

// ==================== 单独更新头像（压缩+删除旧文件） ====================
/**
 * POST /api/users/:id/avatar
 * Content-Type: multipart/form-data, 字段名 avatar
 */
exports.updateAvatar = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: '用户ID不合法' });

    const user = await userModel.getById(userId);
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择图片文件' });
    }

    // 压缩新头像
    const originalPath = req.file.path;
    const newAvatarRelative = await compressAvatar(originalPath, req.file.filename);

    // 更新数据库
    await userModel.updateWechatProfile(userId, user.nickname, newAvatarRelative);

    // 删除旧头像（如果不是默认头像）
    if (user.avatar_url && user.avatar_url !== DEFAULT_AVATAR) {
      await deleteFile(user.avatar_url);
    }

    const updatedUser = await userModel.getById(userId);
    res.json({ success: true, data: formatUser(updatedUser) });
  } catch (err) {
    if (req.file) {
      await deleteFile(`/uploads/avatar/${req.file.filename}`).catch(() => {});
    }
    next(err);
  }
};

// ==================== 状态、角色、列表等（原样） ====================
exports.updateUserStatus = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: '用户ID不合法' });
    const { status } = req.body;
    if (!['active', 'banned'].includes(status)) {
      return res.status(400).json({ success: false, message: '状态值只能是 active 或 banned' });
    }
    await userModel.updateStatus(userId, status);
    const updated = await userModel.getById(userId);
    res.json({ success: true, data: formatUser(updated) });
  } catch (err) { next(err); }
};

exports.updateUserRole = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: '用户ID不合法' });
    const { role } = req.body;
    if (!['observer', 'reviewer', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: '无效的角色值' });
    }
    await userModel.updateRole(userId, role);
    const updated = await userModel.getById(userId);
    res.json({ success: true, data: formatUser(updated) });
  } catch (err) { next(err); }
};

exports.listUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const { role, status, keyword } = req.query;
    const result = await userModel.listUsers({ page, pageSize, role, status, keyword });
    result.list = result.list.map(formatUser);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ==================== 删除用户（删除头像文件） ====================
exports.deleteUser = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: '用户ID不合法' });
    const user = await userModel.getById(userId);
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

    if (user.avatar_url && user.avatar_url !== DEFAULT_AVATAR) {
      await deleteFile(user.avatar_url);
    }
    await userModel.deleteUser(userId);
    res.json({ success: true, message: '用户已删除' });
  } catch (err) { next(err); }
};

// ==================== 唯一性检查、登录（原样） ====================
exports.checkUsername = async (req, res, next) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ success: false, message: '缺少用户名' });
    const taken = await userModel.isUsernameTaken(username);
    res.json({ success: true, data: { username, available: !taken } });
  } catch (err) { next(err); }
};

exports.checkEmail = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, message: '缺少邮箱' });
    const taken = await userModel.isEmailTaken(email);
    res.json({ success: true, data: { email, available: !taken } });
  } catch (err) { next(err); }
};

exports.checkOpenId = async (req, res, next) => {
  try {
    const { openid } = req.query;
    if (!openid) return res.status(400).json({ success: false, message: '缺少 openid' });
    const exists = await userModel.isOpenIdExists(openid);
    res.json({ success: true, data: { openid, available: !exists } });
  } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }
    const user = await userModel.getByUsername(username);
    if (!user) return res.status(401).json({ success: false, message: '用户名或密码错误' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ success: false, message: '用户名或密码错误' });
    if (user.status === 'banned') return res.status(403).json({ success: false, message: '账号已被封禁' });
    await userModel.updateLastLogin(user.user_id);
    res.json({ success: true, data: formatUser(user), message: '登录成功' });
  } catch (err) { next(err); }
};