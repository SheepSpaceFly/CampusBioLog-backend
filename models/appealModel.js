// src/models/appealModel.js
const pool = require('../config/db');

/**
 * 根据申诉ID获取原始数据
 */
const getById = async (appealId) => {
    const [rows] = await pool.query('SELECT * FROM appeal WHERE appeal_id = ?', [appealId]);
    return rows[0] || null;
};

/**
 * 检查申诉是否存在
 */
const exists = async (appealId) => {
    const [[{ cnt }]] = await pool.query('SELECT COUNT(*) as cnt FROM appeal WHERE appeal_id = ?', [appealId]);
    return cnt > 0;
};

/**
 * 创建申诉
 * @param {Object} data - { post_id, user_id, reason, notification_id? }
 */
const create = async ({ post_id, user_id, reason, notification_id = null }) => {
    const [result] = await pool.query(
        `INSERT INTO appeal (post_id, user_id, reason, status, notification_id)
         VALUES (?, ?, ?, 'pending', ?)`,
        [post_id, user_id, reason, notification_id]
    );
    return { appeal_id: result.insertId };
};

/**
 * 审核申诉（管理员操作）
 * @param {number} appealId
 * @param {string} status - 'approved' 或 'rejected'
 * @param {number} reviewerId
 * @param {string} reviewNote - 处理说明
 */
const review = async (appealId, status, reviewerId, reviewNote = null) => {
    await pool.query(
        `UPDATE appeal
         SET status = ?, reviewer_id = ?, review_note = ?, reviewed_at = NOW()
         WHERE appeal_id = ?`,
        [status, reviewerId, reviewNote, appealId]
    );
};

/**
 * 获取申诉列表（分页 + 筛选）
 * @param {Object} options - page, pageSize, status, userId, postId
 */
const list = async ({ page = 1, pageSize = 20, status, userId, postId } = {}) => {
    const conditions = [];
    const values = [];
    if (status) {
        conditions.push('status = ?');
        values.push(status);
    }
    if (userId) {
        conditions.push('user_id = ?');
        values.push(userId);
    }
    if (postId) {
        conditions.push('post_id = ?');
        values.push(postId);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;

    const [rows] = await pool.query(
        `SELECT * FROM appeal ${whereClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [...values, pageSize, offset]
    );

    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) as total FROM appeal ${whereClause}`,
        values
    );

    return { list: rows, total, page, pageSize };
};

/**
 * 删除申诉（硬删除）
 */
const deleteAppeal = async (appealId) => {
    await pool.query('DELETE FROM appeal WHERE appeal_id = ?', [appealId]);
};

module.exports = {
    getById,
    exists,
    create,
    review,
    list,
    deleteAppeal,
};