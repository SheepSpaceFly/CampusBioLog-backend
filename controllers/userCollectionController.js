// src/controllers/userCollectionController.js
const userCollectionModel = require('../models/userCollectionModel');
const userModel = require('../models/userModel');
const speciesModel = require('../models/speciesModel');
const { formatUser, formatSpecies, formatUserCollection } = require('../utils/format');

// ========== 辅助函数：获取完整用户对象 ==========
async function getFullUserById(userId) {
    if (!userId) return null;
    const user = await userModel.getById(userId);
    return formatUser(user);
}

// ========== 辅助函数：获取完整物种对象 ==========
async function getFullSpeciesById(speciesId) {
    if (!speciesId) return null;
    const species = await speciesModel.getById(speciesId);
    return formatSpecies(species);
}

// ========== 辅助函数：组装完整收藏记录（替换 user 和 species） ==========
async function getFullCollectionById(collectionId) {
    const collection = await userCollectionModel.getById(collectionId);
    if (!collection) return null;

    const fullUser = await getFullUserById(collection.user_id);
    const fullSpecies = await getFullSpeciesById(collection.species_id);

    return formatUserCollection(collection, fullUser, fullSpecies);
}

// ==================== 控制器方法 ====================

/**
 * POST /api/collections
 * 添加收藏
 * 请求体: { userId, speciesId }
 */
exports.addCollection = async (req, res, next) => {
    try {
        const { userId, speciesId } = req.body;
        if (!userId || !speciesId) {
            return res.status(400).json({ success: false, message: '缺少用户ID或物种ID' });
        }

        // 检查用户是否存在
        const user = await userModel.getById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }

        // 检查物种是否存在
        const species = await speciesModel.getById(speciesId);
        if (!species) {
            return res.status(404).json({ success: false, message: '物种不存在' });
        }

        // 检查是否已收藏
        const exists = await userCollectionModel.isCollected(userId, speciesId);
        if (exists) {
            return res.status(409).json({ success: false, message: '已经收藏过该物种' });
        }

        const result = await userCollectionModel.addCollection(userId, speciesId);
        const fullCollection = await getFullCollectionById(result.collection_id);
        res.status(201).json({ success: true, data: fullCollection });
    } catch (err) {
        next(err);
    }
};

/**
 * DELETE /api/collections
 * 取消收藏（根据 userId 和 speciesId）
 * 请求体: { userId, speciesId }
 */
exports.removeCollection = async (req, res, next) => {
    try {
        const { userId, speciesId } = req.body;
        if (!userId || !speciesId) {
            return res.status(400).json({ success: false, message: '缺少用户ID或物种ID' });
        }

        const exists = await userCollectionModel.isCollected(userId, speciesId);
        if (!exists) {
            return res.status(404).json({ success: false, message: '收藏记录不存在' });
        }

        await userCollectionModel.removeCollection(userId, speciesId);
        res.json({ success: true, message: '取消收藏成功' });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/collections/check
 * 检查是否已收藏某个物种
 * query: userId, speciesId
 */
exports.checkCollected = async (req, res, next) => {
    try {
        const { userId, speciesId } = req.query;
        if (!userId || !speciesId) {
            return res.status(400).json({ success: false, message: '缺少用户ID或物种ID' });
        }
        const collected = await userCollectionModel.isCollected(parseInt(userId), parseInt(speciesId));
        res.json({ success: true, data: { collected } });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/collections/user/:userId
 * 获取用户的收藏列表（分页）
 * query: page, pageSize
 */
exports.listUserCollections = async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) {
            return res.status(400).json({ success: false, message: '用户ID不合法' });
        }

        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;

        const result = await userCollectionModel.listByUser(userId, { page, pageSize });

        // 将列表中每个收藏记录的物种替换为完整对象（用户对象已冗余，但可省略用户信息以减负，这里选择不加用户对象，因为收藏列表通常不需要用户自身信息）
        // 但为了保持一致性，我们可以只替换物种对象，不返回用户对象（因为所有收藏都属于同一个用户）
        // 此处按照 formatUserCollection 的定义，我们传入用户对象为 null 或仅传入必要信息
        const fullList = [];
        for (const item of result.list) {
            // 获取完整物种对象
            const fullSpecies = await getFullSpeciesById(item.species_id);
            // 收藏记录中用户对象可以不重复返回，节省带宽；若需要则调用 getFullUserById(userId)
            // 这里假设不需要返回用户对象，传递 null
            const formatted = formatUserCollection(item, null, fullSpecies);
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
 * GET /api/collections/user/:userId/species-ids
 * 获取用户收藏的所有物种ID列表（轻量级）
 */
exports.getCollectedSpeciesIds = async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) {
            return res.status(400).json({ success: false, message: '用户ID不合法' });
        }
        const speciesIds = await userCollectionModel.getCollectedSpeciesIds(userId);
        res.json({ success: true, data: { speciesIds } });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/collections/stats/species/:speciesId
 * 获取某个物种的收藏人数
 */
exports.getCollectionCountBySpecies = async (req, res, next) => {
    try {
        const speciesId = parseInt(req.params.speciesId);
        if (isNaN(speciesId)) {
            return res.status(400).json({ success: false, message: '物种ID不合法' });
        }
        const count = await userCollectionModel.getCollectionCountBySpecies(speciesId);
        res.json({ success: true, data: { speciesId, collectionCount: count } });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/collections/stats/user/:userId
 * 获取用户的收藏总数
 */
exports.getCollectionCountByUser = async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) {
            return res.status(400).json({ success: false, message: '用户ID不合法' });
        }
        const count = await userCollectionModel.getCollectionCountByUser(userId);
        res.json({ success: true, data: { userId, collectionCount: count } });
    } catch (err) {
        next(err);
    }
};