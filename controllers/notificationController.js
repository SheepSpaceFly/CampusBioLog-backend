// src/controllers/notificationController.js
const notificationModel = require('../models/notificationModel');
const userModel = require('../models/userModel');
const { formatUser, formatNotification } = require('../utils/format');

// ========== 辅助函数：获取完整用户对象 ==========
async function getFullUserById(userId) {
    if (!userId) return null;
    const user = await userModel.getById(userId);
    return formatUser(user);
}

// ========== 辅助函数：组装完整通知对象 ==========
async function getFullNotificationById(notificationId) {
    const notif = await notificationModel.getById(notificationId);
    if (!notif) return null;
    const fullUser = await getFullUserById(notif.user_id);
    const fullSourceUser = await getFullUserById(notif.source_user_id);
    return formatNotification(notif, fullUser, fullSourceUser);
}

// ==================== 控制器方法 ====================

/**
 * POST /api/notifications
 * 创建通知
 * 请求体: { userId, type, sourceUserId?, targetId?, content? }
 */
exports.createNotification = async (req, res, next) => {
    try {
        const { userId, type, sourceUserId, targetId, content } = req.body;
        if (!userId || !type) {
            return res.status(400).json({ success: false, message: '缺少必要参数 userId 或 type' });
        }

        // 验证接收用户存在
        const user = await userModel.getById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: '接收通知的用户不存在' });
        }

        const newNotif = await notificationModel.create({
            user_id: userId,
            type,
            source_user_id: sourceUserId || null,
            target_id: targetId || null,
            content: content || null,
        });

        const fullNotif = await getFullNotificationById(newNotif.notification_id);
        res.status(201).json({ success: true, data: fullNotif });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/notifications
 * 获取用户通知列表（前端直接传 userId）
 * query: userId, page, pageSize, isRead (0/1)
 */
exports.listNotifications = async (req, res, next) => {
    try {
        const userId = parseInt(req.query.userId);
        if (!userId || isNaN(userId)) {
            return res.status(400).json({ success: false, message: '缺少或无效的 userId' });
        }

        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const isRead = req.query.isRead !== undefined ? parseInt(req.query.isRead) : undefined;

        const result = await notificationModel.listByUser(userId, { page, pageSize, isRead });

        const fullList = [];
        for (const notif of result.list) {
            const fullNotif = await getFullNotificationById(notif.notification_id);
            if (fullNotif) fullList.push(fullNotif);
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
 * GET /api/notifications/unread-count
 * 获取用户未读通知数量（前端直接传 userId）
 * query: userId
 */
exports.getUnreadCount = async (req, res, next) => {
    try {
        const userId = parseInt(req.query.userId);
        if (!userId || isNaN(userId)) {
            return res.status(400).json({ success: false, message: '缺少或无效的 userId' });
        }
        const count = await notificationModel.getUnreadCount(userId);
        res.json({ success: true, data: { userId, unreadCount: count } });
    } catch (err) {
        next(err);
    }
};

/**
 * PUT /api/notifications/:notificationId/read
 * 将单个通知标记为已读（前端直接传 userId）
 * 请求体: { userId }
 */
exports.markAsRead = async (req, res, next) => {
    try {
        const notificationId = parseInt(req.params.notificationId);
        const { userId } = req.body;
        if (isNaN(notificationId) || !userId) {
            return res.status(400).json({ success: false, message: '参数错误' });
        }
        await notificationModel.markAsRead(notificationId, userId);
        res.json({ success: true, message: '已标记为已读' });
    } catch (err) {
        next(err);
    }
};

/**
 * PUT /api/notifications/read-all
 * 将用户所有通知标记为已读（前端直接传 userId）
 * 请求体: { userId }
 */
exports.markAllAsRead = async (req, res, next) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, message: '缺少 userId' });
        }
        await notificationModel.markAllAsRead(userId);
        res.json({ success: true, message: '所有通知已标记为已读' });
    } catch (err) {
        next(err);
    }
};

/**
 * DELETE /api/notifications/:notificationId
 * 删除通知（前端直接传 userId）
 * 请求体: { userId }
 */
exports.deleteNotification = async (req, res, next) => {
    try {
        const notificationId = parseInt(req.params.notificationId);
        const { userId } = req.body;
        if (isNaN(notificationId) || !userId) {
            return res.status(400).json({ success: false, message: '参数错误' });
        }
        await notificationModel.deleteNotification(notificationId, userId);
        res.json({ success: true, message: '通知已删除' });
    } catch (err) {
        next(err);
    }
};