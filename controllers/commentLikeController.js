// src/controllers/commentLikeController.js
const commentLikeModel = require('../models/commentLikeModel');
const commentModel = require('../models/commentModel');
const userModel = require('../models/userModel');

/**
 * POST /api/comment-likes
 * 点赞评论
 * 请求体: { commentId, userId }
 */
exports.likeComment = async (req, res, next) => {
    try {
        const { commentId, userId } = req.body;
        if (!commentId || !userId) {
            return res.status(400).json({ success: false, message: '缺少评论ID或用户ID' });
        }

        // 检查评论是否存在且可见
        const commentExists = await commentModel.exists(commentId);
        if (!commentExists) {
            return res.status(404).json({ success: false, message: '评论不存在或已删除' });
        }

        // 检查用户是否存在
        const user = await userModel.getById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }

        // 检查是否已点赞
        const liked = await commentLikeModel.isLiked(commentId, userId);
        if (liked) {
            return res.status(409).json({ success: false, message: '已经点过赞了' });
        }

        await commentLikeModel.addLike(commentId, userId);
        const newCount = await commentLikeModel.getLikeCount(commentId);
        res.status(201).json({
            success: true,
            data: { commentId, userId, liked: true, likeCount: newCount },
        });
    } catch (err) {
        next(err);
    }
};

/**
 * DELETE /api/comment-likes
 * 取消点赞评论
 * 请求体: { commentId, userId }
 */
exports.unlikeComment = async (req, res, next) => {
    try {
        const { commentId, userId } = req.body;
        if (!commentId || !userId) {
            return res.status(400).json({ success: false, message: '缺少评论ID或用户ID' });
        }

        const liked = await commentLikeModel.isLiked(commentId, userId);
        if (!liked) {
            return res.status(404).json({ success: false, message: '尚未点赞，无法取消' });
        }

        await commentLikeModel.removeLike(commentId, userId);
        const newCount = await commentLikeModel.getLikeCount(commentId);
        res.json({
            success: true,
            data: { commentId, userId, liked: false, likeCount: newCount },
        });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/comment-likes/check
 * 检查用户是否已点赞某评论
 * query: commentId, userId
 */
exports.checkLiked = async (req, res, next) => {
    try {
        const { commentId, userId } = req.query;
        if (!commentId || !userId) {
            return res.status(400).json({ success: false, message: '缺少评论ID或用户ID' });
        }
        const liked = await commentLikeModel.isLiked(parseInt(commentId), parseInt(userId));
        res.json({ success: true, data: { commentId: parseInt(commentId), userId: parseInt(userId), liked } });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/comment-likes/count/:commentId
 * 获取评论的点赞总数
 */
exports.getLikeCount = async (req, res, next) => {
    try {
        const commentId = parseInt(req.params.commentId);
        if (isNaN(commentId)) {
            return res.status(400).json({ success: false, message: '评论ID不合法' });
        }
        const count = await commentLikeModel.getLikeCount(commentId);
        res.json({ success: true, data: { commentId, likeCount: count } });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/comment-likes/user/:userId
 * 获取用户点赞的所有评论ID列表
 */
exports.getUserLikedComments = async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) {
            return res.status(400).json({ success: false, message: '用户ID不合法' });
        }
        const commentIds = await commentLikeModel.getLikedCommentIds(userId);
        res.json({ success: true, data: { userId, likedCommentIds: commentIds } });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/comment-likes/comment/:commentId/users
 * 获取点赞某评论的用户ID列表（可限制数量）
 * query: limit (可选)
 */
exports.getCommentLikedUsers = async (req, res, next) => {
    try {
        const commentId = parseInt(req.params.commentId);
        if (isNaN(commentId)) {
            return res.status(400).json({ success: false, message: '评论ID不合法' });
        }
        const limit = req.query.limit ? parseInt(req.query.limit) : null;
        const userIds = await commentLikeModel.getLikedUserIds(commentId, limit);
        res.json({ success: true, data: { commentId, likedUserIds: userIds } });
    } catch (err) {
        next(err);
    }
};