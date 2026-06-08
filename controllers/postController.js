// src/controllers/postController.js
const postModel = require('../models/postModel');
const observationModel = require('../models/observationModel');
const { formatObservation, formatPost } = require('../utils/format');

// ========== 辅助函数：获取完整的观测对象 ==========
async function getFullObservationById(obsId) {
    if (!obsId) return null;
    const obsRow = await observationModel.getById(obsId);
    if (!obsRow) return null;
    const photos = await observationModel.getPhotosByObsId(obsId);
    return formatObservation(obsRow, photos);
}

// ========== 辅助函数：组装完整帖子对象（替换 obs 为完整对象） ==========
async function getFullPostById(postId) {
    const post = await postModel.getById(postId);
    if (!post) return null;
    const fullObservation = await getFullObservationById(post.obs_id);
    return formatPost(post, fullObservation);
}

// ==================== 控制器方法 ====================

/**
 * POST /api/posts
 * 创建帖子
 * 请求体: { obsId?, priority?, status? }  // status 默认为 published
 */
exports.createPost = async (req, res, next) => {
    try {
        const { obsId, priority, status } = req.body;

        // 如果提供了 obsId，需要验证观测记录是否存在
        if (obsId) {
            const obs = await observationModel.getById(obsId);
            if (!obs) {
                return res.status(404).json({ success: false, message: '关联的观测记录不存在' });
            }
        }

        const newPost = await postModel.create({
            obs_id: obsId || null,
            priority: priority !== undefined ? priority : 0,
            status: status || 'published',
        });

        const fullPost = await getFullPostById(newPost.post_id);
        res.status(201).json({ success: true, data: fullPost });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/posts/:postId
 * 获取单个帖子（自动增加浏览量）
 */
exports.getPostById = async (req, res, next) => {
    try {
        const postId = parseInt(req.params.postId);
        if (isNaN(postId)) {
            return res.status(400).json({ success: false, message: '帖子ID不合法' });
        }

        // 先查询是否存在
        const exists = await postModel.exists(postId);
        if (!exists) {
            return res.status(404).json({ success: false, message: '帖子不存在或已删除' });
        }

        // 增加浏览量（异步，无需等待结果）
        await postModel.incrementViewCount(postId);

        const fullPost = await getFullPostById(postId);
        res.json({ success: true, data: fullPost });
    } catch (err) {
        next(err);
    }
};

/**
 * PUT /api/posts/:postId
 * 更新帖子（可修改 obs_id, priority, status）
 * 注意：不允许修改 view_count、created_at、updated_at 自动维护
 */
exports.updatePost = async (req, res, next) => {
    try {
        const postId = parseInt(req.params.postId);
        if (isNaN(postId)) {
            return res.status(400).json({ success: false, message: '帖子ID不合法' });
        }

        const exists = await postModel.exists(postId);
        if (!exists) {
            return res.status(404).json({ success: false, message: '帖子不存在或已删除' });
        }

        const { obsId, priority, status } = req.body;

        // 如果提供了 obsId，验证观测记录是否存在
        if (obsId !== undefined && obsId !== null) {
            const obs = await observationModel.getById(obsId);
            if (!obs) {
                return res.status(404).json({ success: false, message: '关联的观测记录不存在' });
            }
        }

        const updateData = {};
        if (obsId !== undefined) updateData.obs_id = obsId;
        if (priority !== undefined) updateData.priority = priority;
        if (status !== undefined) updateData.status = status;

        await postModel.update(postId, updateData);
        const fullPost = await getFullPostById(postId);
        res.json({ success: true, data: fullPost });
    } catch (err) {
        next(err);
    }
};

/**
 * DELETE /api/posts/:postId
 * 软删除帖子（将 status 改为 'deleted'）
 */
exports.deletePost = async (req, res, next) => {
    try {
        const postId = parseInt(req.params.postId);
        if (isNaN(postId)) {
            return res.status(400).json({ success: false, message: '帖子ID不合法' });
        }

        const exists = await postModel.exists(postId);
        if (!exists) {
            return res.status(404).json({ success: false, message: '帖子不存在或已删除' });
        }

        await postModel.softDelete(postId);
        res.json({ success: true, message: '帖子已删除' });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/posts
 * 帖子列表（分页 + 筛选）
 * 支持 query: page, pageSize, status, sortBy, order
 */
exports.listPosts = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const status = req.query.status; // 可选，如不传则自动排除已删除
        const sortBy = req.query.sortBy || 'created_at';
        const order = req.query.order || 'DESC';

        // 允许的排序字段
        const allowedSortFields = ['created_at', 'updated_at', 'priority', 'view_count'];
        const finalSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';

        const result = await postModel.list({
            page,
            pageSize,
            status,
            sortBy: finalSortBy,
            order,
        });

        // 将每个帖子组装完整对象
        const fullList = [];
        for (const post of result.list) {
            const fullPost = await getFullPostById(post.post_id);
            if (fullPost) fullList.push(fullPost);
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
 * GET /api/posts/by-obs/:obsId
 * 根据观测记录ID获取关联的帖子（通常一个观测对应一个帖子，返回数组）
 */
exports.getPostsByObsId = async (req, res, next) => {
    try {
        const obsId = parseInt(req.params.obsId);
        if (isNaN(obsId)) {
            return res.status(400).json({ success: false, message: '观测记录ID不合法' });
        }
        const posts = await postModel.getByObsId(obsId);
        const fullList = [];
        for (const post of posts) {
            const fullPost = await getFullPostById(post.post_id);
            if (fullPost) fullList.push(fullPost);
        }
        res.json({ success: true, data: fullList });
    } catch (err) {
        next(err);
    }
};