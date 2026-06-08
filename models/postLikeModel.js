// src/models/postLikeModel.js
const pool = require('../config/db');

/**
 * 添加点赞（记录到表中）
 * @param {number} postId
 * @param {number} userId
 */
const addLike = async (postId, userId) => {
    await pool.query(
        'INSERT INTO post_like (post_id, user_id) VALUES (?, ?)',
        [postId, userId]
    );
};

/**
 * 取消点赞（删除记录）
 * @param {number} postId
 * @param {number} userId
 */
const removeLike = async (postId, userId) => {
    await pool.query(
        'DELETE FROM post_like WHERE post_id = ? AND user_id = ?',
        [postId, userId]
    );
};

/**
 * 检查用户是否已点赞
 * @param {number} postId
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
const isLiked = async (postId, userId) => {
    const [[{ cnt }]] = await pool.query(
        'SELECT COUNT(*) as cnt FROM post_like WHERE post_id = ? AND user_id = ?',
        [postId, userId]
    );
    return cnt > 0;
};

/**
 * 获取帖子的点赞总数
 * @param {number} postId
 * @returns {Promise<number>}
 */
const getLikeCount = async (postId) => {
    const [[{ cnt }]] = await pool.query(
        'SELECT COUNT(*) as cnt FROM post_like WHERE post_id = ?',
        [postId]
    );
    return cnt;
};

/**
 * 获取用户点赞的所有帖子ID列表
 * @param {number} userId
 * @returns {Promise<number[]>}
 */
const getLikedPostIds = async (userId) => {
    const [rows] = await pool.query(
        'SELECT post_id FROM post_like WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
    );
    return rows.map(row => row.post_id);
};

/**
 * 获取某个帖子的点赞用户ID列表（可用于展示部分头像，但通常不展开）
 * @param {number} postId
 * @param {number} limit - 可选限制返回数量
 * @returns {Promise<number[]>}
 */
const getLikedUserIds = async (postId, limit = null) => {
    let sql = 'SELECT user_id FROM post_like WHERE post_id = ? ORDER BY created_at DESC';
    const params = [postId];
    if (limit) {
        sql += ' LIMIT ?';
        params.push(limit);
    }
    const [rows] = await pool.query(sql, params);
    return rows.map(row => row.user_id);
};

module.exports = {
    addLike,
    removeLike,
    isLiked,
    getLikeCount,
    getLikedPostIds,
    getLikedUserIds,
};