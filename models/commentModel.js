// src/models/commentModel.js
const pool = require('../config/db');

/**
 * 根据评论ID获取原始数据（不包括已删除的）
 */
const getById = async (commentId) => {
    const [rows] = await pool.query(
        'SELECT * FROM comment WHERE comment_id = ? AND status = "visible"',
        [commentId]
    );
    return rows[0] || null;
};

/**
 * 检查评论是否存在且可见
 */
const exists = async (commentId) => {
    const [[{ cnt }]] = await pool.query(
        'SELECT COUNT(*) as cnt FROM comment WHERE comment_id = ? AND status = "visible"',
        [commentId]
    );
    return cnt > 0;
};

/**
 * 创建评论
 */
const create = async ({ post_id, user_id, parent_comment_id = null, content }) => {
    const [result] = await pool.query(
        `INSERT INTO comment (post_id, user_id, parent_comment_id, content, status)
         VALUES (?, ?, ?, ?, 'visible')`,
        [post_id, user_id, parent_comment_id, content]
    );
    return { comment_id: result.insertId, post_id, user_id, parent_comment_id, content };
};

/**
 * 更新评论内容
 */
const updateContent = async (commentId, content) => {
    await pool.query(
        'UPDATE comment SET content = ? WHERE comment_id = ? AND status = "visible"',
        [content, commentId]
    );
};

/**
 * 软删除评论
 */
const softDelete = async (commentId) => {
    await pool.query(
        "UPDATE comment SET status = 'deleted' WHERE comment_id = ?",
        [commentId]
    );
};

const banComment = async (commentId) => {
    await pool.query(
        "UPDATE comment SET status = 'banned' WHERE comment_id = ?",
        [commentId]
    );
};

/**
 * 获取某个帖子的所有可见评论（扁平列表，按创建时间升序）
 */
const getFlatCommentsByPostId = async (postId) => {
    const [rows] = await pool.query(
        `SELECT * FROM comment
         WHERE post_id = ? AND status = 'visible'
         ORDER BY created_at ASC`,
        [postId]
    );
    return rows;
};

/**
 * 获取某个帖子的评论总数
 */
const getCommentCountByPostId = async (postId) => {
    const [[{ cnt }]] = await pool.query(
        'SELECT COUNT(*) as cnt FROM comment WHERE post_id = ? AND status = "visible"',
        [postId]
    );
    return cnt;
};

/**
 * 获取某个用户的所有评论（分页）
 */
const listByUserId = async (userId, { page = 1, pageSize = 20 } = {}) => {
    const offset = (page - 1) * pageSize;
    const [rows] = await pool.query(
        `SELECT * FROM comment
         WHERE user_id = ? AND status = 'visible'
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, pageSize, offset]
    );
    const [[{ total }]] = await pool.query(
        'SELECT COUNT(*) as total FROM comment WHERE user_id = ? AND status = "visible"',
        [userId]
    );
    return { list: rows, total, page, pageSize };
};

/**
 * 获取某个评论的所有直接子评论
 */
const getChildren = async (commentId) => {
    const [rows] = await pool.query(
        'SELECT * FROM comment WHERE parent_comment_id = ? AND status = "visible" ORDER BY created_at ASC',
        [commentId]
    );
    return rows;
};

module.exports = {
    getById,
    exists,
    create,
    updateContent,
    softDelete,
    banComment,
    getFlatCommentsByPostId,
    getCommentCountByPostId,
    listByUserId,
    getChildren,
};