// src/controllers/observationController.js
const observationModel = require('../models/observationModel');
const { formatObservation } = require('../utils/format');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

// 辅助函数：生成预览图，返回预览图相对路径
async function generatePreview(originalPath, filename) {
  const dir = path.dirname(originalPath);
  const ext = path.extname(filename);
  const previewName = `preview_${path.basename(filename, ext)}.jpg`;
  const previewPath = path.join(dir, previewName);
  await sharp(originalPath)
    .resize(800, null, { withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(previewPath);
  return `/uploads/observation_photos/${previewName}`;
}

// 物理删除文件
async function deleteFile(relativePath) {
  if (!relativePath) return;
  const fullPath = path.join(__dirname, '../../', relativePath);
  try { await fs.unlink(fullPath); } catch (err) { console.error('文件删除失败', fullPath, err); }
}

// ==================== 辅助权限检查（基于 userId 参数） ====================
const checkOwner = async (obsId, reqUserId) => {
  const ownerId = await observationModel.getOwnerId(obsId);
  if (!ownerId) return { allowed: false, error: '观测记录不存在', status: 404 };
  if (ownerId !== reqUserId) return { allowed: false, error: '无权操作', status: 403 };
  return { allowed: true, ownerId };
};

// ==================== 获取观测记录（附带照片） ====================
/** GET /api/observations/:obsId */
exports.getObservationById = async (req, res, next) => {
  try {
    const obsId = parseInt(req.params.obsId);
    if (isNaN(obsId)) return res.status(400).json({ success: false, message: 'ID不合法' });
    const row = await observationModel.getById(obsId);
    if (!row) return res.status(404).json({ success: false, message: '观测记录不存在' });
    const photos = await observationModel.getPhotosByObsId(obsId);
    const formatted = formatObservation(row, photos);
    res.json({ success: true, data: formatted });
  } catch (err) { next(err); }
};

/** GET /api/observations (列表，每项附带 photos 数组) */
exports.listObservations = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const { userId, speciesId, locationId, status, keyword } = req.query;
    const result = await observationModel.listObservations({
      page, pageSize,
      userId: userId ? parseInt(userId) : undefined,
      speciesId: speciesId ? parseInt(speciesId) : undefined,
      locationId: locationId ? parseInt(locationId) : undefined,
      status, keyword,
    });
    // 为每条记录查询照片（可优化批量查询）
    const listWithPhotos = [];
    for (const row of result.list) {
      const photos = await observationModel.getPhotosByObsId(row.obs_id);
      listWithPhotos.push(formatObservation(row, photos));
    }
    res.json({ success: true, data: { ...result, list: listWithPhotos } });
  } catch (err) { next(err); }
};

/** GET /api/observations/user/:userId */
exports.getObservationsByUser = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: '用户ID不合法' });
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const result = await observationModel.getByUserId(userId, { page, pageSize });
    const listWithPhotos = [];
    for (const row of result.list) {
      const photos = await observationModel.getPhotosByObsId(row.obs_id);
      listWithPhotos.push(formatObservation(row, photos));
    }
    res.json({ success: true, data: { ...result, list: listWithPhotos } });
  } catch (err) { next(err); }
};

// ==================== 创建观测（带照片上传） ====================
exports.createObservation = async (req, res, next) => {
  try {
    // 从 body 中获取字段（前端使用驼峰命名）
    const { userId, speciesId, locationId, content, status } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId 不能为空' });
    if (!locationId) return res.status(400).json({ success: false, message: '地点为必填项' });

    // 1. 创建观测记录（将驼峰转换为 Model 需要的蛇形字段）
    const obsIdObj = await observationModel.createObservation({
      user_id: parseInt(userId),
      species_id: speciesId ? parseInt(speciesId) : null,
      location_id: parseInt(locationId),
      content: content || null,
      status: status || 'pending_review',
    });
    const obsId = obsIdObj.obs_id;

    // 2. 处理上传的照片
    const files = req.files || [];
    const photoRecords = [];
    for (const file of files) {
      const originalRelative = `/uploads/observation_photos/${file.filename}`;
      const previewRelative = await generatePreview(file.path, file.filename);
      photoRecords.push({
        obs_id: obsId,
        file_path: originalRelative,
        preview_path: previewRelative,
      });
    }
    if (photoRecords.length) {
      await observationModel.createPhotos(photoRecords);
    }

    // 3. 返回完整观测（含照片）
    const newObsRow = await observationModel.getById(obsId);
    const photos = await observationModel.getPhotosByObsId(obsId);
    res.status(201).json({ success: true, data: formatObservation(newObsRow, photos) });
  } catch (err) {
    // 出错时尝试删除已上传的文件
    if (req.files) {
      for (const file of req.files) await deleteFile(`/uploads/observation_photos/${file.filename}`).catch(() => {});
    }
    next(err);
  }
};

// ==================== 更新观测（仅基本信息，不处理照片） ====================
exports.updateObservation = async (req, res, next) => {
  try {
    const obsId = parseInt(req.params.obsId);
    if (isNaN(obsId)) return res.status(400).json({ success: false, message: 'ID不合法' });
    const { userId, speciesId, locationId, content } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: '缺少 userId' });
    const perm = await checkOwner(obsId, parseInt(userId));
    if (!perm.allowed) return res.status(perm.status).json({ success: false, message: perm.error });

    // 构建更新对象（蛇形）
    const updateData = {};
    if (speciesId !== undefined) updateData.species_id = speciesId ? parseInt(speciesId) : null;
    if (locationId !== undefined) updateData.location_id = parseInt(locationId);
    if (content !== undefined) updateData.content = content;

    await observationModel.updateObservation(obsId, updateData);
    const updatedRow = await observationModel.getById(obsId);
    const photos = await observationModel.getPhotosByObsId(obsId);
    res.json({ success: true, data: formatObservation(updatedRow, photos) });
  } catch (err) { next(err); }
};

// ==================== 更新状态 ====================
exports.updateObservationStatus = async (req, res, next) => {
  try {
    const obsId = parseInt(req.params.obsId);
    if (isNaN(obsId)) return res.status(400).json({ success: false, message: 'ID不合法' });
    
    const { userId, status } = req.body; // userId 仅用于记录，暂不校验权限
    
    // ✅ 添加存在性检查
    const exists = await observationModel.exists(obsId);
    if (!exists) {
      return res.status(404).json({ success: false, message: '观测记录不存在' });
    }
    
    const validStatuses = ['pending_review', 'approved', 'rejected', 'needs_identification', 'identified'];
    if (!validStatuses.includes(status)) return res.status(400).json({ success: false, message: '无效状态' });
    
    await observationModel.updateStatus(obsId, status);
    const updatedRow = await observationModel.getById(obsId);
    const photos = await observationModel.getPhotosByObsId(obsId);
    res.json({ success: true, data: formatObservation(updatedRow, photos) });
  } catch (err) {
    next(err);
  }
};

// ==================== 删除观测（级联删除照片文件） ====================
exports.deleteObservation = async (req, res, next) => {
  try {
    const obsId = parseInt(req.params.obsId);
    if (isNaN(obsId)) return res.status(400).json({ success: false, message: 'ID不合法' });
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: '缺少 userId' });
    const perm = await checkOwner(obsId, parseInt(userId));
    if (!perm.allowed) return res.status(perm.status).json({ success: false, message: perm.error });

    // 获取所有照片文件路径并物理删除
    const photos = await observationModel.getPhotosByObsId(obsId);
    for (const photo of photos) {
      await deleteFile(photo.file_path);
      await deleteFile(photo.preview_path);
    }
    // 数据库删除（外键级联删除照片记录）
    await observationModel.deleteObservation(obsId);
    res.json({ success: true, message: '观测记录已删除' });
  } catch (err) { next(err); }
};

// ==================== 单独删除某张照片 ====================
exports.deletePhoto = async (req, res, next) => {
  try {
    const obsId = parseInt(req.params.obsId);
    const photoId = parseInt(req.params.photoId);
    if (isNaN(obsId) || isNaN(photoId)) return res.status(400).json({ success: false, message: 'ID不合法' });
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: '缺少 userId' });
    const perm = await checkOwner(obsId, parseInt(userId));
    if (!perm.allowed) return res.status(perm.status).json({ success: false, message: perm.error });

    const photo = await observationModel.getPhotoById(photoId);
    if (!photo || photo.obs_id !== obsId) return res.status(404).json({ success: false, message: '照片不存在或不属于该观测' });
    // 物理删除文件
    await deleteFile(photo.file_path);
    await deleteFile(photo.preview_path);
    // 删除数据库记录
    await observationModel.deletePhotoRecord(photoId);
    res.json({ success: true, message: '照片已删除' });
  } catch (err) { next(err); }
};

// ==================== 为已有观测追加照片 ====================
exports.addPhotosToObservation = async (req, res, next) => {
  try {
    const obsId = parseInt(req.params.obsId);
    if (isNaN(obsId)) {
      return res.status(400).json({ success: false, message: '观测ID不合法' });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: '缺少 userId' });
    }

    // 权限校验：只有观测拥有者才能追加照片
    const perm = await checkOwner(obsId, parseInt(userId));
    if (!perm.allowed) {
      return res.status(perm.status).json({ success: false, message: perm.error });
    }

    // 检查观测是否存在（checkOwner 已做存在性检查，但为了明确提示，再校验一次）
    const exists = await observationModel.exists(obsId);
    if (!exists) {
      return res.status(404).json({ success: false, message: '观测记录不存在' });
    }

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: '至少上传一张图片' });
    }
    if (files.length > 10) {
      return res.status(400).json({ success: false, message: '一次最多上传10张图片' });
    }

    // 处理每一张照片：生成原图路径和预览图路径
    const photoRecords = [];
    for (const file of files) {
      const originalRelative = `/uploads/observation_photos/${file.filename}`;
      const previewRelative = await generatePreview(file.path, file.filename);
      photoRecords.push({
        obs_id: obsId,
        file_path: originalRelative,
        preview_path: previewRelative,
      });
    }

    // 批量插入照片记录
    await observationModel.createPhotos(photoRecords);

    // 返回更新后的观测完整信息（包含所有照片）
    const updatedRow = await observationModel.getById(obsId);
    const allPhotos = await observationModel.getPhotosByObsId(obsId);
    const formatted = formatObservation(updatedRow, allPhotos);
    res.status(201).json({ success: true, data: formatted });
  } catch (err) {
    // 出错时尝试删除已上传的文件（清理现场）
    if (req.files) {
      for (const file of req.files) {
        await deleteFile(`/uploads/observation_photos/${file.filename}`).catch(() => {});
      }
    }
    next(err);
  }
};

// ==================== 统计接口 ====================

/** GET /api/observations/count/user/:userId - 获取用户观测总数 */
exports.countByUser = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: '用户ID不合法' });
    }
    const count = await observationModel.countByUser(userId);
    res.json({ success: true, data: { userId, count } });
  } catch (err) { next(err); }
};

/** GET /api/observations/count/species/:speciesId - 获取物种被观测次数 */
exports.countBySpecies = async (req, res, next) => {
  try {
    const speciesId = parseInt(req.params.speciesId);
    if (isNaN(speciesId)) {
      return res.status(400).json({ success: false, message: '物种ID不合法' });
    }
    const count = await observationModel.countBySpecies(speciesId);
    res.json({ success: true, data: { speciesId, count } });
  } catch (err) { next(err); }
};