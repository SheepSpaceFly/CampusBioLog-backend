// src/models/postModel.js
const pool = require('../config/db');

const getById = async (postId) => {
    const [rows] = await pool.query('SELECT * FROM post WHERE post_id = ?', [postId]);
    return rows[0] || null;
};

const exists = async (postId) => {
    const [[{ cnt }]] = await pool.query('SELECT COUNT(*) as cnt FROM post WHERE post_id = ?', [postId]);
    return cnt > 0;
};

const create = async ({ obs_id = null, priority = 0, status = 'published', allow_comment = 1 }) => {
    const [result] = await pool.query(
        `INSERT INTO post (obs_id, priority, status, allow_comment)
         VALUES (?, ?, ?, ?)`,
        [obs_id, priority, status, allow_comment]
    );
    return { post_id: result.insertId, obs_id, priority, status, allow_comment };
};

const update = async (postId, data) => {
    const fields = [];
    const values = [];
    if (data.obs_id !== undefined) {
        fields.push('obs_id = ?');
        values.push(data.obs_id);
    }
    if (data.priority !== undefined) {
        fields.push('priority = ?');
        values.push(data.priority);
    }
    if (data.status !== undefined) {
        fields.push('status = ?');
        values.push(data.status);
    }
    if (data.allow_comment !== undefined) {
        fields.push('allow_comment = ?');
        values.push(data.allow_comment);
    }
    if (fields.length === 0) return;
    values.push(postId);
    await pool.query(
        `UPDATE post SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE post_id = ?`,
        values
    );
};

const softDelete = async (postId) => {
    await pool.query("UPDATE post SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE post_id = ?", [postId]);
};

const incrementViewCount = async (postId) => {
    await pool.query('UPDATE post SET view_count = view_count + 1 WHERE post_id = ?', [postId]);
};

/**
 * 获取帖子列表（分页 + 筛选）
 * @param {Object} options
 * @param {number} options.page
 * @param {number} options.pageSize
 * @param {string} [options.status] - 可选，传了则精确匹配该状态，不传则返回所有状态
 * @param {number} [options.priority]
 * @param {string} [options.sortBy]
 * @param {string} [options.order]
 */
const list = async ({ page = 1, pageSize = 20, status, priority, sortBy = 'created_at', order = 'DESC' } = {}) => {
    const conditions = [];
    const values = [];

    if (status !== undefined && status !== null && status !== '') {
        conditions.push('status = ?');
        values.push(status);
    }
    // 如果没有传 status，不加任何 status 条件，返回所有状态

    if (priority !== undefined && priority !== null) {
        conditions.push('priority = ?');
        values.push(priority);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;
    const orderClause = `ORDER BY ${sortBy} ${order === 'DESC' ? 'DESC' : 'ASC'}`;

    const [rows] = await pool.query(
        `SELECT * FROM post ${whereClause} ${orderClause} LIMIT ? OFFSET ?`,
        [...values, pageSize, offset]
    );

    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) as total FROM post ${whereClause}`,
        values
    );

    return { list: rows, total, page, pageSize };
};

/**
 * 根据观测记录ID查询关联的帖子
 * @param {number} obsId
 * @param {string|null} [statusFilter] - 可选，不传则返回所有状态，传则精确匹配
 */
const getByObsId = async (obsId, statusFilter = null) => {
    let sql = 'SELECT * FROM post WHERE obs_id = ?';
    const params = [obsId];
    if (statusFilter) {
        sql += ' AND status = ?';
        params.push(statusFilter);
    }
    const [rows] = await pool.query(sql, params);
    return rows;
};

module.exports = {
    getById,
    exists,
    create,
    update,
    softDelete,
    incrementViewCount,
    list,
    getByObsId,
};