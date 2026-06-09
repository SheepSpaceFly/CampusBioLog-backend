// src/models/commentModel.js
const pool = require('../config/db');

const getById = async (commentId) => {
    const [rows] = await pool.query('SELECT * FROM comment WHERE comment_id = ?', [commentId]);
    return rows[0] || null;
};

const exists = async (commentId) => {
    const [[{ cnt }]] = await pool.query('SELECT COUNT(*) as cnt FROM comment WHERE comment_id = ?', [commentId]);
    return cnt > 0;
};

const create = async ({ post_id, user_id, parent_comment_id = null, content }) => {
    const [result] = await pool.query(
        `INSERT INTO comment (post_id, user_id, parent_comment_id, content, status)
         VALUES (?, ?, ?, ?, 'visible')`,
        [post_id, user_id, parent_comment_id, content]
    );
    return { comment_id: result.insertId, post_id, user_id, parent_comment_id, content };
};

const update = async (commentId, fields) => {
    if (!fields || Object.keys(fields).length === 0) return;

    const allowedFields = ['content', 'status'];
    const setClauses = [];
    const values = [];

    for (const [key, value] of Object.entries(fields)) {
        if (allowedFields.includes(key)) {
            setClauses.push(`${key} = ?`);
            values.push(value);
        }
    }

    if (setClauses.length === 0) return;

    values.push(commentId);
    const query = `UPDATE comment SET ${setClauses.join(', ')} WHERE comment_id = ?`;
    await pool.query(query, values);
};

const softDelete = async (commentId) => {
    await pool.query("UPDATE comment SET status = 'deleted' WHERE comment_id = ?", [commentId]);
};

const banComment = async (commentId) => {
    await pool.query("UPDATE comment SET status = 'banned' WHERE comment_id = ?", [commentId]);
};

/**
 * 获取某个帖子的评论（扁平列表）
 * @param {number} postId
 * @param {string|null} [statusFilter] - 可选，不传则返回所有状态，传则精确匹配
 */
const getFlatCommentsByPostId = async (postId, statusFilter = null) => {
    let sql = 'SELECT * FROM comment WHERE post_id = ?';
    const params = [postId];
    if (statusFilter) {
        sql += ' AND status = ?';
        params.push(statusFilter);
    }
    sql += ' ORDER BY created_at ASC';
    const [rows] = await pool.query(sql, params);
    return rows;
};

/**
 * 获取某个帖子的评论总数
 * @param {number} postId
 * @param {string|null} [statusFilter] - 可选，不传则统计所有状态
 */
const getCommentCountByPostId = async (postId, statusFilter = null) => {
    let sql = 'SELECT COUNT(*) as cnt FROM comment WHERE post_id = ?';
    const params = [postId];
    if (statusFilter) {
        sql += ' AND status = ?';
        params.push(statusFilter);
    }
    const [[{ cnt }]] = await pool.query(sql, params);
    return cnt;
};

/**
 * 获取某个用户的所有评论（分页）
 * @param {number} userId
 * @param {Object} options
 * @param {number} options.page
 * @param {number} options.pageSize
 * @param {string|null} [options.statusFilter] - 可选，不传则返回所有状态
 */
const listByUserId = async (userId, { page = 1, pageSize = 20, statusFilter = null } = {}) => {
    const offset = (page - 1) * pageSize;
    let sql = 'SELECT * FROM comment WHERE user_id = ?';
    const params = [userId];
    if (statusFilter) {
        sql += ' AND status = ?';
        params.push(statusFilter);
    }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);
    const [rows] = await pool.query(sql, params);

    let countSql = 'SELECT COUNT(*) as total FROM comment WHERE user_id = ?';
    const countParams = [userId];
    if (statusFilter) {
        countSql += ' AND status = ?';
        countParams.push(statusFilter);
    }
    const [[{ total }]] = await pool.query(countSql, countParams);

    return { list: rows, total, page, pageSize };
};

/**
 * 获取某个评论的所有直接子评论
 * @param {number} commentId
 * @param {string|null} [statusFilter] - 可选，不传则返回所有状态
 */
const getChildren = async (commentId, statusFilter = null) => {
    let sql = 'SELECT * FROM comment WHERE parent_comment_id = ?';
    const params = [commentId];
    if (statusFilter) {
        sql += ' AND status = ?';
        params.push(statusFilter);
    }
    sql += ' ORDER BY created_at ASC';
    const [rows] = await pool.query(sql, params);
    return rows;
};

module.exports = {
    getById,
    exists,
    create,
    update,
    softDelete,
    banComment,
    getFlatCommentsByPostId,
    getCommentCountByPostId,
    listByUserId,
    getChildren,
};