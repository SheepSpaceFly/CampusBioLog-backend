// src/controllers/appealController.js
const appealModel = require('../models/appealModel');
const postModel = require('../models/postModel');
const userModel = require('../models/userModel');
const { formatUser, formatAppeal } = require('../utils/format');

// ========== 辅助函数：获取完整用户对象 ==========
async function getFullUserById(userId) {
    if (!userId) return null;
    const user = await userModel.getById(userId);
    return formatUser(user);
}

// ========== 辅助函数：组装完整申诉对象 ==========
async function getFullAppealById(appealId) {
    const appeal = await appealModel.getById(appealId);
    if (!appeal) return null;
    const fullUser = await getFullUserById(appeal.user_id);
    const fullReviewer = await getFullUserById(appeal.reviewer_id);
    return formatAppeal(appeal, fullUser, fullReviewer);
}

// ==================== 控制器方法 ====================

/**
 * POST /api/appeals
 * 用户提交申诉
 * 请求体: { postId, userId, reason, notificationId? }
 */
exports.createAppeal = async (req, res, next) => {
    try {
        const { postId, userId, reason, notificationId } = req.body;
        if (!postId || !userId || !reason) {
            return res.status(400).json({ success: false, message: '缺少必要参数: postId, userId, reason' });
        }
        if (reason.length > 1000) {
            return res.status(400).json({ success: false, message: '申诉理由不能超过1000字符' });
        }

        // 检查帖子是否存在（未被软删除？通常封禁的帖子仍存在，只是状态可能为 deleted 或 banned，这里仅检查存在性）
        const postExists = await postModel.exists(postId);
        if (!postExists) {
            return res.status(404).json({ success: false, message: '帖子不存在或已删除' });
        }

        // 检查用户是否存在
        const user = await userModel.getById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }

        // 可选：检查该用户对该帖子是否已经存在 pending 状态的申诉（避免重复申诉）
        const existingList = await appealModel.list({ userId, postId, status: 'pending' });
        if (existingList.total > 0) {
            return res.status(409).json({ success: false, message: '您已提交过申诉，请等待处理' });
        }

        const newAppeal = await appealModel.create({
            post_id: postId,
            user_id: userId,
            reason,
            notification_id: notificationId || null,
        });

        const fullAppeal = await getFullAppealById(newAppeal.appeal_id);
        res.status(201).json({ success: true, data: fullAppeal });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/appeals/:appealId
 * 获取单个申诉详情
 */
exports.getAppealById = async (req, res, next) => {
    try {
        const appealId = parseInt(req.params.appealId);
        if (isNaN(appealId)) {
            return res.status(400).json({ success: false, message: '申诉ID不合法' });
        }
        const fullAppeal = await getFullAppealById(appealId);
        if (!fullAppeal) {
            return res.status(404).json({ success: false, message: '申诉不存在' });
        }
        res.json({ success: true, data: fullAppeal });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/appeals
 * 申诉列表（分页 + 筛选）  完全信任前端，直接接收参数
 * query: page, pageSize, status, userId, postId
 */
exports.listAppeals = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const status = req.query.status;   // pending, approved, rejected
        const userId = req.query.userId ? parseInt(req.query.userId) : undefined;
        const postId = req.query.postId ? parseInt(req.query.postId) : undefined;

        const result = await appealModel.list({ page, pageSize, status, userId, postId });

        // 组装完整申诉列表
        const fullList = [];
        for (const appeal of result.list) {
            const full = await getFullAppealById(appeal.appeal_id);
            if (full) fullList.push(full);
        }

        res.json({
            success: true,
            data: {
                list: fullList,
                total: result.total,
                page: result.page,
                pageSize: result.pageSize,
            },
        });
    } catch (err) {
        next(err);
    }
};

/**
 * PUT /api/appeals/:appealId/review
 * 管理员审核申诉（通过/驳回）
 * 请求体: { status, reviewerId, reviewNote }
 * 若 status = 'approved'，同时需解封帖子（将帖子的 status 从 deleted 改回 published？具体逻辑由业务定义）
 */
exports.reviewAppeal = async (req, res, next) => {
    try {
        const appealId = parseInt(req.params.appealId);
        const { status, reviewerId, reviewNote } = req.body;
        if (isNaN(appealId)) {
            return res.status(400).json({ success: false, message: '申诉ID不合法' });
        }
        if (!status || !['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: '状态必须是 approved 或 rejected' });
        }
        if (!reviewerId) {
            return res.status(400).json({ success: false, message: '缺少审核员ID' });
        }

        const appeal = await appealModel.getById(appealId);
        if (!appeal) {
            return res.status(404).json({ success: false, message: '申诉不存在' });
        }
        if (appeal.status !== 'pending') {
            return res.status(400).json({ success: false, message: '该申诉已经被处理' });
        }

        // 审核操作
        await appealModel.review(appealId, status, reviewerId, reviewNote || null);

        // 如果申诉通过（approved），需要解封帖子（将帖子 status 从 'deleted' 改回 'published'）
        // 注意：这里假设帖子被封禁时 status 被设置为 'deleted'，解封改为 'published'
        if (status === 'approved') {
            await postModel.update(appeal.post_id, { status: 'published' });
        }

        const fullAppeal = await getFullAppealById(appealId);
        res.json({ success: true, data: fullAppeal });
    } catch (err) {
        next(err);
    }
};

/**
 * DELETE /api/appeals/:appealId
 * 删除申诉（硬删除，一般仅管理员可用）
 * 请求体: { userId } 用于权限校验（完全信任前端，仅需传递 userId 确认操作者，实际可省略）
 */
exports.deleteAppeal = async (req, res, next) => {
    try {
        const appealId = parseInt(req.params.appealId);
        if (isNaN(appealId)) {
            return res.status(400).json({ success: false, message: '申诉ID不合法' });
        }
        const exists = await appealModel.exists(appealId);
        if (!exists) {
            return res.status(404).json({ success: false, message: '申诉不存在' });
        }
        await appealModel.deleteAppeal(appealId);
        res.json({ success: true, message: '申诉已删除' });
    } catch (err) {
        next(err);
    }
};