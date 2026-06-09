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

    const userIds = [...new Set(flatComments.map(c => c.user_id))];
    const userMap = new Map();
    for (const uid of userIds) {
        const fullUser = await getFullUserById(uid);
        if (fullUser) userMap.set(uid, fullUser);
    }

    const commentMap = new Map();
    const roots = [];

    for (const comment of flatComments) {
        const fullUser = userMap.get(comment.user_id) || null;
        const formatted = formatComment(comment, fullUser);
        commentMap.set(comment.comment_id, { ...formatted, children: [] });
    }

    for (const comment of flatComments) {
        const node = commentMap.get(comment.comment_id);
        if (comment.parent_comment_id === null) {
            roots.push(node);
        } else {
            const parentNode = commentMap.get(comment.parent_comment_id);
            if (parentNode) {
                parentNode.children.push(node);
            } else {
                roots.push(node);
            }
        }
    }
    return roots;
}

// ==================== 控制器方法 ====================

exports.createComment = async (req, res, next) => {
    try {
        const { postId, userId, parentCommentId, content } = req.body;
        if (!postId || !userId || !content) {
            return res.status(400).json({ success: false, message: '缺少必要参数：postId, userId, content' });
        }
        if (content.length > 1000) {
            return res.status(400).json({ success: false, message: '评论内容不能超过1000字符' });
        }

        const postExists = await postModel.exists(postId);
        if (!postExists) {
            return res.status(404).json({ success: false, message: '帖子不存在或已删除' });
        }

        const user = await userModel.getById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }

        if (parentCommentId) {
            const parentExists = await commentModel.exists(parentCommentId);
            if (!parentExists) {
                return res.status(404).json({ success: false, message: '父评论不存在' });
            }
            // 可选：检查父评论状态是否为 visible，若需要严格限制可取消注释
            // const parent = await commentModel.getById(parentCommentId);
            // if (parent.status !== 'visible') {
            //     return res.status(400).json({ success: false, message: '父评论不可回复' });
            // }
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

exports.getCommentById = async (req, res, next) => {
    try {
        const commentId = parseInt(req.params.commentId);
        if (isNaN(commentId)) {
            return res.status(400).json({ success: false, message: '评论ID不合法' });
        }
        const comment = await commentModel.getById(commentId);
        if (!comment) {
            return res.status(404).json({ success: false, message: '评论不存在' });
        }
        const fullUser = await getFullUserById(comment.user_id);
        const formatted = formatComment(comment, fullUser);
        res.json({ success: true, data: formatted });
    } catch (err) {
        next(err);
    }
};

exports.updateComment = async (req, res, next) => {
    try {
        const commentId = parseInt(req.params.commentId);
        if (isNaN(commentId)) {
            return res.status(400).json({ success: false, message: '评论ID不合法' });
        }

        const comment = await commentModel.getById(commentId);
        if (!comment) {
            return res.status(404).json({ success: false, message: '评论不存在' });
        }

        const { content, status } = req.body;

        const updateFields = {};

        if (content !== undefined) {
            if (typeof content !== 'string' || content.length === 0 || content.length > 1000) {
                return res.status(400).json({ success: false, message: '评论内容长度需在1-1000字符之间' });
            }
            updateFields.content = content;
        }

        if (status !== undefined) {
            const validStatuses = ['visible', 'deleted', 'banned'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ success: false, message: '无效的状态值，可选：visible, deleted, banned' });
            }
            updateFields.status = status;
        }

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ success: false, message: '没有提供任何需要更新的字段' });
        }

        await commentModel.update(commentId, updateFields);

        const updatedComment = await commentModel.getById(commentId);
        const fullUser = await getFullUserById(updatedComment.user_id);
        const formatted = formatComment(updatedComment, fullUser);
        res.json({ success: true, data: formatted });
    } catch (err) {
        next(err);
    }
};

exports.deleteComment = async (req, res, next) => {
    try {
        const commentId = parseInt(req.params.commentId);
        if (isNaN(commentId)) {
            return res.status(400).json({ success: false, message: '评论ID不合法' });
        }
        const comment = await commentModel.getById(commentId);
        if (!comment) {
            return res.status(404).json({ success: false, message: '评论不存在' });
        }

        await commentModel.softDelete(commentId);
        res.json({ success: true, message: '评论已删除' });
    } catch (err) {
        next(err);
    }
};

exports.getCommentTreeByPost = async (req, res, next) => {
    try {
        const postId = parseInt(req.params.postId);
        if (isNaN(postId)) {
            return res.status(400).json({ success: false, message: '帖子ID不合法' });
        }

        const page = req.query.page ? parseInt(req.query.page) : null;
        const pageSize = req.query.pageSize ? parseInt(req.query.pageSize) : null;
        const statusFilter = req.query.status || null;  // 可选参数，如 ?status=visible

        const flatComments = await commentModel.getFlatCommentsByPostId(postId, statusFilter);
        if (!flatComments.length) {
            return res.json({ success: true, data: { list: [], total: 0, page: 1, pageSize: 20 } });
        }

        const roots = await buildCommentTree(flatComments);

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

exports.getCommentsByUser = async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) {
            return res.status(400).json({ success: false, message: '用户ID不合法' });
        }
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const statusFilter = req.query.status || null;

        const result = await commentModel.listByUserId(userId, { page, pageSize, statusFilter });

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

exports.getCommentCount = async (req, res, next) => {
    try {
        const postId = parseInt(req.params.postId);
        if (isNaN(postId)) {
            return res.status(400).json({ success: false, message: '帖子ID不合法' });
        }
        const statusFilter = req.query.status || null;
        const count = await commentModel.getCommentCountByPostId(postId, statusFilter);
        res.json({ success: true, data: { postId, commentCount: count } });
    } catch (err) {
        next(err);
    }
};