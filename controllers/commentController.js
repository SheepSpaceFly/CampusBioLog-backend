// src/controllers/commentController.js
const commentModel = require('../models/commentModel');
const postModel = require('../models/postModel');
const userModel = require('../models/userModel');
const { formatUser, formatComment } = require('../utils/format');

// ========== 辅助函数：获取完整用户对象 ==========
async function getFullUserById(userId) {
    if (!userId) return null;
    const user = await userModel.getById(userId);
    return formatUser(user);
}

// ========== 辅助函数：构建评论树（扁平 -> 树形，每个节点包含 children） ==========
async function buildCommentTree(flatComments) {
    if (!flatComments.length) return [];

    // 预加载所有用户对象（避免在循环中重复查询）
    const userIds = [...new Set(flatComments.map(c => c.user_id))];
    const userMap = new Map();
    for (const uid of userIds) {
        const fullUser = await getFullUserById(uid);
        if (fullUser) userMap.set(uid, fullUser);
    }

    const commentMap = new Map();
    const roots = [];

    // 先格式化所有评论（不包含 children）
    for (const comment of flatComments) {
        const fullUser = userMap.get(comment.user_id) || null;
        const formatted = formatComment(comment, fullUser);
        commentMap.set(comment.comment_id, { ...formatted, children: [] });
    }

    // 组装树结构
    for (const comment of flatComments) {
        const node = commentMap.get(comment.comment_id);
        if (comment.parent_comment_id === null) {
            roots.push(node);
        } else {
            const parentNode = commentMap.get(comment.parent_comment_id);
            if (parentNode) {
                parentNode.children.push(node);
            } else {
                // 父评论可能已被删除，则作为顶级评论
                roots.push(node);
            }
        }
    }
    return roots;
}

// ==================== 控制器方法 ====================

/**
 * POST /api/comments
 * 创建评论
 * 请求体: { postId, userId, parentCommentId?, content }
 */
exports.createComment = async (req, res, next) => {
    try {
        const { postId, userId, parentCommentId, content } = req.body;
        if (!postId || !userId || !content) {
            return res.status(400).json({ success: false, message: '缺少必要参数：postId, userId, content' });
        }
        if (content.length > 1000) {
            return res.status(400).json({ success: false, message: '评论内容不能超过1000字符' });
        }

        // 检查帖子是否存在
        const postExists = await postModel.exists(postId);
        if (!postExists) {
            return res.status(404).json({ success: false, message: '帖子不存在或已删除' });
        }

        // 检查用户是否存在
        const user = await userModel.getById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }

        // 如果提供了父评论ID，检查父评论是否存在且可见
        if (parentCommentId) {
            const parentExists = await commentModel.exists(parentCommentId);
            if (!parentExists) {
                return res.status(404).json({ success: false, message: '父评论不存在或已删除' });
            }
        }

        const newComment = await commentModel.create({
            post_id: postId,
            user_id: userId,
            parent_comment_id: parentCommentId || null,
            content,
        });

        const fullUser = await getFullUserById(userId);
        const formatted = formatComment(newComment, fullUser);
        res.status(201).json({ success: true, data: formatted });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/comments/:commentId
 * 获取单个评论
 */
exports.getCommentById = async (req, res, next) => {
    try {
        const commentId = parseInt(req.params.commentId);
        if (isNaN(commentId)) {
            return res.status(400).json({ success: false, message: '评论ID不合法' });
        }
        const comment = await commentModel.getById(commentId);
        if (!comment) {
            return res.status(404).json({ success: false, message: '评论不存在或已删除' });
        }
        const fullUser = await getFullUserById(comment.user_id);
        const formatted = formatComment(comment, fullUser);
        res.json({ success: true, data: formatted });
    } catch (err) {
        next(err);
    }
};

/**
 * PUT /api/comments/:commentId
 * 更新评论内容
 * 请求体: { content }
 */
exports.updateComment = async (req, res, next) => {
    try {
        const commentId = parseInt(req.params.commentId);
        if (isNaN(commentId)) {
            return res.status(400).json({ success: false, message: '评论ID不合法' });
        }
        const { content } = req.body;
        if (!content) {
            return res.status(400).json({ success: false, message: '评论内容不能为空' });
        }
        if (content.length > 1000) {
            return res.status(400).json({ success: false, message: '评论内容不能超过1000字符' });
        }

        const comment = await commentModel.getById(commentId);
        if (!comment) {
            return res.status(404).json({ success: false, message: '评论不存在或已删除' });
        }

        await commentModel.updateContent(commentId, content);

        // 返回更新后的评论
        const updatedComment = await commentModel.getById(commentId);
        const fullUser = await getFullUserById(updatedComment.user_id);
        const formatted = formatComment(updatedComment, fullUser);
        res.json({ success: true, data: formatted });
    } catch (err) {
        next(err);
    }
};

/**
 * DELETE /api/comments/:commentId
 * 软删除评论
 */
exports.deleteComment = async (req, res, next) => {
    try {
        const commentId = parseInt(req.params.commentId);
        if (isNaN(commentId)) {
            return res.status(400).json({ success: false, message: '评论ID不合法' });
        }
        const comment = await commentModel.getById(commentId);
        if (!comment) {
            return res.status(404).json({ success: false, message: '评论不存在或已删除' });
        }

        await commentModel.softDelete(commentId);
        res.json({ success: true, message: '评论已删除' });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/comments/by-post/:postId
 * 获取某个帖子的评论树（嵌套结构）
 * 支持分页：可传入 page, pageSize 对顶级评论进行分页
 */
exports.getCommentTreeByPost = async (req, res, next) => {
    try {
        const postId = parseInt(req.params.postId);
        if (isNaN(postId)) {
            return res.status(400).json({ success: false, message: '帖子ID不合法' });
        }

        const page = req.query.page ? parseInt(req.query.page) : null;
        const pageSize = req.query.pageSize ? parseInt(req.query.pageSize) : null;

        // 获取所有可见评论（扁平）
        const flatComments = await commentModel.getFlatCommentsByPostId(postId);
        if (!flatComments.length) {
            return res.json({ success: true, data: { list: [], total: 0, page: 1, pageSize: 20 } });
        }

        // 构建树
        const roots = await buildCommentTree(flatComments);

        // 分页处理（仅对顶级评论分页）
        let finalRoots = roots;
        let total = roots.length;
        if (page !== null && pageSize !== null && pageSize > 0) {
            const offset = (page - 1) * pageSize;
            finalRoots = roots.slice(offset, offset + pageSize);
        }

        res.json({
            success: true,
            data: {
                list: finalRoots,
                total,
                page: page || 1,
                pageSize: pageSize || total,
            },
        });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/comments/by-user/:userId
 * 获取某个用户的所有评论（分页，扁平列表）
 */
exports.getCommentsByUser = async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) {
            return res.status(400).json({ success: false, message: '用户ID不合法' });
        }
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;

        const result = await commentModel.listByUserId(userId, { page, pageSize });

        // 格式化每条评论
        const fullList = [];
        for (const comment of result.list) {
            const fullUser = await getFullUserById(comment.user_id);
            const formatted = formatComment(comment, fullUser);
            fullList.push(formatted);
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
 * GET /api/comments/count/:postId
 * 获取某个帖子的评论总数
 */
exports.getCommentCount = async (req, res, next) => {
    try {
        const postId = parseInt(req.params.postId);
        if (isNaN(postId)) {
            return res.status(400).json({ success: false, message: '帖子ID不合法' });
        }
        const count = await commentModel.getCommentCountByPostId(postId);
        res.json({ success: true, data: { postId, commentCount: count } });
    } catch (err) {
        next(err);
    }
};