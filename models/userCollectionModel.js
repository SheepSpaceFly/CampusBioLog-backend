// src/models/userCollectionModel.js
const pool = require('../config/db');

/**
 * 添加收藏（如果已存在则忽略重复，建议先检查）
 * @param {number} userId
 * @param {number} speciesId
 * @returns {Promise<{collection_id: number}>}
 */
const addCollection = async (userId, speciesId) => {
    const [result] = await pool.query(
        `INSERT INTO user_collection (user_id, species_id)
         VALUES (?, ?)`,
        [userId, speciesId]
    );
    return { collection_id: result.insertId };
};

/**
 * 取消收藏（删除记录）
 * @param {number} userId
 * @param {number} speciesId
 */
const removeCollection = async (userId, speciesId) => {
    await pool.query(
        'DELETE FROM user_collection WHERE user_id = ? AND species_id = ?',
        [userId, speciesId]
    );
};

/**
 * 检查是否已收藏
 * @param {number} userId
 * @param {number} speciesId
 * @returns {Promise<boolean>}
 */
const isCollected = async (userId, speciesId) => {
    const [[{ cnt }]] = await pool.query(
        'SELECT COUNT(*) as cnt FROM user_collection WHERE user_id = ? AND species_id = ?',
        [userId, speciesId]
    );
    return cnt > 0;
};

/**
 * 根据收藏ID获取收藏记录原始数据
 * @param {number} collectionId
 */
const getById = async (collectionId) => {
    const [rows] = await pool.query(
        'SELECT * FROM user_collection WHERE collection_id = ?',
        [collectionId]
    );
    return rows[0] || null;
};

/**
 * 获取用户收藏列表（分页，包含关联的物种信息）
 * @param {number} userId
 * @param {object} options - { page, pageSize }
 * @returns {Promise<{list: Array, total: number, page: number, pageSize: number}>}
 */
const listByUser = async (userId, { page = 1, pageSize = 20 } = {}) => {
    const offset = (page - 1) * pageSize;

    // 查询收藏列表，并 JOIN species 表获取物种基本信息（后续会在 Controller 中组装完整物种对象）
    const [rows] = await pool.query(
        `SELECT uc.collection_id, uc.user_id, uc.species_id, uc.collected_at,
                s.species_name, s.description, s.created_at
         FROM user_collection uc
         INNER JOIN species s ON uc.species_id = s.species_id
         WHERE uc.user_id = ?
         ORDER BY uc.collected_at DESC
         LIMIT ? OFFSET ?`,
        [userId, pageSize, offset]
    );

    // 查询总数
    const [[{ total }]] = await pool.query(
        'SELECT COUNT(*) as total FROM user_collection WHERE user_id = ?',
        [userId]
    );

    return { list: rows, total, page, pageSize };
};

/**
 * 获取用户收藏的物种ID列表（用于快速检查）
 * @param {number} userId
 * @returns {Promise<number[]>}
 */
const getCollectedSpeciesIds = async (userId) => {
    const [rows] = await pool.query(
        'SELECT species_id FROM user_collection WHERE user_id = ?',
        [userId]
    );
    return rows.map(row => row.species_id);
};

/**
 * 获取某个物种的收藏人数（统计）
 * @param {number} speciesId
 * @returns {Promise<number>}
 */
const getCollectionCountBySpecies = async (speciesId) => {
    const [[{ cnt }]] = await pool.query(
        'SELECT COUNT(*) as cnt FROM user_collection WHERE species_id = ?',
        [speciesId]
    );
    return cnt;
};

/**
 * 获取用户收藏总数
 * @param {number} userId
 * @returns {Promise<number>}
 */
const getCollectionCountByUser = async (userId) => {
    const [[{ cnt }]] = await pool.query(
        'SELECT COUNT(*) as cnt FROM user_collection WHERE user_id = ?',
        [userId]
    );
    return cnt;
};

module.exports = {
    addCollection,
    removeCollection,
    isCollected,
    getById,
    listByUser,
    getCollectedSpeciesIds,
    getCollectionCountBySpecies,
    getCollectionCountByUser,
};