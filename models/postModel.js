// src/models/postModel.js
const pool = require('../config/db');

/**
 * 根据帖子ID获取原始数据
 */
const getById = async (postId) => {
    const [rows] = await pool.query(
        'SELECT * FROM post WHERE post_id = ?',
        [postId]
    );
    return rows[0] || null;
};

/**
 * 检查帖子是否存在（未软删除/封禁的）
 */
const exists = async (postId) => {
    const [[{ cnt }]] = await pool.query(
        'SELECT COUNT(*) as cnt FROM post WHERE post_id = ? AND status NOT IN ("deleted", "banned")',
        [postId]
    );
    return cnt > 0;
};

/**
 * 创建帖子
 * @param {Object} data - { obs_id, priority, status, allow_comment }
 */
const create = async ({ obs_id = null, priority = 0, status = 'published', allow_comment = 1 }) => {
    const [result] = await pool.query(
        `INSERT INTO post (obs_id, priority, status, allow_comment)
         VALUES (?, ?, ?, ?)`,
        [obs_id, priority, status, allow_comment]
    );
    return { post_id: result.insertId, obs_id, priority, status, allow_comment };
};

/**
 * 更新帖子（仅更新允许的字段）
 * @param {number} postId
 * @param {Object} data - 可包含 obs_id, priority, status, allow_comment
 */
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

/**
 * 软删除帖子（将 status 改为 'deleted'）
 */
const softDelete = async (postId) => {
    await pool.query(
        "UPDATE post SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE post_id = ?",
        [postId]
    );
};

/**
 * 增加浏览量（原子操作）
 */
const incrementViewCount = async (postId) => {
    await pool.query(
        'UPDATE post SET view_count = view_count + 1 WHERE post_id = ?',
        [postId]
    );
};

/**
 * 获取帖子列表（分页 + 筛选）
 * @param {Object} options - page, pageSize, status, priority, sortBy (priority, created_at, view_count), order
 */
const list = async ({ 
    page = 1, 
    pageSize = 20, 
    status, 
    priority,
    sortBy = 'created_at', 
    order = 'DESC' 
} = {}) => {
    const conditions = [];
    const values = [];

    if (status) {
        conditions.push('status = ?');
        values.push(status);
    } else {
        conditions.push("status NOT IN ('deleted', 'banned')");
    }

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
 * 根据观测记录ID查询关联的帖子（可能一对多，但通常一个观测对应一个帖子，这里仍返回数组）
 */
const getByObsId = async (obsId) => {
    const [rows] = await pool.query(
        'SELECT * FROM post WHERE obs_id = ? AND status != "deleted"',
        [obsId]
    );
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