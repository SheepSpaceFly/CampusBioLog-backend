// src/models/commentLikeModel.js
const pool = require('../config/db');

/**
 * 添加评论点赞
 * @param {number} commentId
 * @param {number} userId
 */
const addLike = async (commentId, userId) => {
    await pool.query(
        'INSERT INTO comment_like (comment_id, user_id) VALUES (?, ?)',
        [commentId, userId]
    );
};

/**
 * 取消评论点赞
 * @param {number} commentId
 * @param {number} userId
 */
const removeLike = async (commentId, userId) => {
    await pool.query(
        'DELETE FROM comment_like WHERE comment_id = ? AND user_id = ?',
        [commentId, userId]
    );
};

/**
 * 检查用户是否已点赞某评论
 * @param {number} commentId
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
const isLiked = async (commentId, userId) => {
    const [[{ cnt }]] = await pool.query(
        'SELECT COUNT(*) as cnt FROM comment_like WHERE comment_id = ? AND user_id = ?',
        [commentId, userId]
    );
    return cnt > 0;
};

/**
 * 获取评论的点赞总数
 * @param {number} commentId
 * @returns {Promise<number>}
 */
const getLikeCount = async (commentId) => {
    const [[{ cnt }]] = await pool.query(
        'SELECT COUNT(*) as cnt FROM comment_like WHERE comment_id = ?',
        [commentId]
    );
    return cnt;
};

/**
 * 获取用户点赞的所有评论ID列表
 * @param {number} userId
 * @returns {Promise<number[]>}
 */
const getLikedCommentIds = async (userId) => {
    const [rows] = await pool.query(
        'SELECT comment_id FROM comment_like WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
    );
    return rows.map(row => row.comment_id);
};

/**
 * 获取某个评论的点赞用户ID列表（可用于展示部分头像）
 * @param {number} commentId
 * @param {number|null} limit
 * @returns {Promise<number[]>}
 */
const getLikedUserIds = async (commentId, limit = null) => {
    let sql = 'SELECT user_id FROM comment_like WHERE comment_id = ? ORDER BY created_at DESC';
    const params = [commentId];
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
    getLikedCommentIds,
    getLikedUserIds,
};