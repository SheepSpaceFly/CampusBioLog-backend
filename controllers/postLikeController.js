// src/controllers/postLikeController.js
const postLikeModel = require('../models/postLikeModel');
const postModel = require('../models/postModel');
const userModel = require('../models/userModel');

/**
 * POST /api/post-likes
 * 点赞帖子
 * 请求体: { postId, userId }
 */
exports.likePost = async (req, res, next) => {
    try {
        const { postId, userId } = req.body;
        if (!postId || !userId) {
            return res.status(400).json({ success: false, message: '缺少帖子ID或用户ID' });
        }

        // 检查帖子是否存在（未删除）
        const postExists = await postModel.exists(postId);
        if (!postExists) {
            return res.status(404).json({ success: false, message: '帖子不存在或已删除' });
        }

        // 检查用户是否存在
        const user = await userModel.getById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }

        // 检查是否已点赞
        const liked = await postLikeModel.isLiked(postId, userId);
        if (liked) {
            return res.status(409).json({ success: false, message: '已经点过赞了' });
        }

        await postLikeModel.addLike(postId, userId);
        const newCount = await postLikeModel.getLikeCount(postId);
        res.status(201).json({
            success: true,
            data: { postId, userId, liked: true, likeCount: newCount },
        });
    } catch (err) {
        next(err);
    }
};

/**
 * DELETE /api/post-likes
 * 取消点赞
 * 请求体: { postId, userId }
 */
exports.unlikePost = async (req, res, next) => {
    try {
        const { postId, userId } = req.body;
        if (!postId || !userId) {
            return res.status(400).json({ success: false, message: '缺少帖子ID或用户ID' });
        }

        const liked = await postLikeModel.isLiked(postId, userId);
        if (!liked) {
            return res.status(404).json({ success: false, message: '尚未点赞，无法取消' });
        }

        await postLikeModel.removeLike(postId, userId);
        const newCount = await postLikeModel.getLikeCount(postId);
        res.json({
            success: true,
            data: { postId, userId, liked: false, likeCount: newCount },
        });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/post-likes/check
 * 检查用户是否已点赞某帖子
 * query: postId, userId
 */
exports.checkLiked = async (req, res, next) => {
    try {
        const { postId, userId } = req.query;
        if (!postId || !userId) {
            return res.status(400).json({ success: false, message: '缺少帖子ID或用户ID' });
        }
        const liked = await postLikeModel.isLiked(parseInt(postId), parseInt(userId));
        res.json({ success: true, data: { postId: parseInt(postId), userId: parseInt(userId), liked } });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/post-likes/count/:postId
 * 获取帖子的点赞总数
 */
exports.getLikeCount = async (req, res, next) => {
    try {
        const postId = parseInt(req.params.postId);
        if (isNaN(postId)) {
            return res.status(400).json({ success: false, message: '帖子ID不合法' });
        }
        const count = await postLikeModel.getLikeCount(postId);
        res.json({ success: true, data: { postId, likeCount: count } });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/post-likes/user/:userId
 * 获取用户点赞的所有帖子ID列表
 */
exports.getUserLikedPosts = async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) {
            return res.status(400).json({ success: false, message: '用户ID不合法' });
        }
        const postIds = await postLikeModel.getLikedPostIds(userId);
        res.json({ success: true, data: { userId, likedPostIds: postIds } });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/post-likes/post/:postId/users
 * 获取点赞某帖子的用户ID列表（可限制数量，用于展示部分头像）
 * query: limit (可选)
 */
exports.getPostLikedUsers = async (req, res, next) => {
    try {
        const postId = parseInt(req.params.postId);
        if (isNaN(postId)) {
            return res.status(400).json({ success: false, message: '帖子ID不合法' });
        }
        const limit = req.query.limit ? parseInt(req.query.limit) : null;
        const userIds = await postLikeModel.getLikedUserIds(postId, limit);
        res.json({ success: true, data: { postId, likedUserIds: userIds } });
    } catch (err) {
        next(err);
    }
};