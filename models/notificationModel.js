// src/models/notificationModel.js
const pool = require('../config/db');

/**
 * 创建通知
 * @param {Object} data - { user_id, type, source_user_id, target_id, content }
 */
const create = async ({ user_id, type, source_user_id = null, target_id = null, content = null }) => {
    const [result] = await pool.query(
        `INSERT INTO notification 
         (user_id, type, source_user_id, target_id, content, is_read)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [user_id, type, source_user_id, target_id, content]
    );
    return { notification_id: result.insertId };
};

/**
 * 根据ID获取通知原始数据
 */
const getById = async (notificationId) => {
    const [rows] = await pool.query(
        'SELECT * FROM notification WHERE notification_id = ?',
        [notificationId]
    );
    return rows[0] || null;
};

/**
 * 获取用户的通知列表（分页，可按已读/未读筛选）
 * @param {number} userId
 * @param {Object} options - { page, pageSize, isRead }  isRead: 0未读,1已读,undefined全部
 */
const listByUser = async (userId, { page = 1, pageSize = 20, isRead } = {}) => {
    const conditions = ['user_id = ?'];
    const values = [userId];
    if (isRead !== undefined) {
        conditions.push('is_read = ?');
        values.push(isRead);
    }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const offset = (page - 1) * pageSize;

    const [rows] = await pool.query(
        `SELECT * FROM notification ${whereClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [...values, pageSize, offset]
    );

    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) as total FROM notification ${whereClause}`,
        values
    );

    return { list: rows, total, page, pageSize };
};

/**
 * 获取用户未读通知数量
 */
const getUnreadCount = async (userId) => {
    const [[{ cnt }]] = await pool.query(
        'SELECT COUNT(*) as cnt FROM notification WHERE user_id = ? AND is_read = 0',
        [userId]
    );
    return cnt;
};

/**
 * 将单个通知标记为已读
 */
const markAsRead = async (notificationId, userId) => {
    await pool.query(
        'UPDATE notification SET is_read = 1 WHERE notification_id = ? AND user_id = ?',
        [notificationId, userId]
    );
};

/**
 * 将用户所有通知标记为已读
 */
const markAllAsRead = async (userId) => {
    await pool.query(
        'UPDATE notification SET is_read = 1 WHERE user_id = ? AND is_read = 0',
        [userId]
    );
};

/**
 * 删除通知（硬删除）
 */
const deleteNotification = async (notificationId, userId) => {
    await pool.query(
        'DELETE FROM notification WHERE notification_id = ? AND user_id = ?',
        [notificationId, userId]
    );
};

module.exports = {
    create,
    getById,
    listByUser,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
};