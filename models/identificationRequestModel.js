// src/models/identificationRequestModel.js
const pool = require('../config/db');

/**
 * 根据鉴定请求ID获取原始记录
 */
const getById = async (reqId) => {
    const [rows] = await pool.query(
        'SELECT * FROM identification_request WHERE req_id = ?',
        [reqId]
    );
    return rows[0] || null;
};

/**
 * 根据观测记录ID获取鉴定请求（唯一）
 */
const getByObsId = async (obsId) => {
    const [rows] = await pool.query(
        'SELECT * FROM identification_request WHERE obs_id = ?',
        [obsId]
    );
    return rows[0] || null;
};

/**
 * 创建鉴定请求
 * @param {number} obsId
 * @param {string|null} reqSpeciesName - 请求类别名（推测）
 * @param {string|null} reviewNote - 审核备注（可选）
 */
const create = async (obsId, reqSpeciesName = null, reviewNote = null) => {
    const [result] = await pool.query(
        `INSERT INTO identification_request (obs_id, status, req_species_name, review_note)
         VALUES (?, 'pending', ?, ?)`,
        [obsId, reqSpeciesName, reviewNote]
    );
    return { req_id: result.insertId, obs_id: obsId, status: 'pending', req_species_name: reqSpeciesName, review_note: reviewNote };
};

/**
 * 更新鉴定请求字段
 * @param {number} reqId
 * @param {object} data - 可包含 status, req_species_name, result_species_id, review_note, reviewer_id
 */
const update = async (reqId, data) => {
    const fields = [];
    const values = [];
    if (data.status !== undefined) {
        fields.push('status = ?');
        values.push(data.status);
    }
    if (data.req_species_name !== undefined) {
        fields.push('req_species_name = ?');
        values.push(data.req_species_name);
    }
    if (data.result_species_id !== undefined) {
        fields.push('result_species_id = ?');
        values.push(data.result_species_id);
    }
    if (data.review_note !== undefined) {
        fields.push('review_note = ?');
        values.push(data.review_note);
    }
    if (data.reviewer_id !== undefined) {
        fields.push('reviewer_id = ?');
        values.push(data.reviewer_id);
    }
    if (fields.length === 0) return;
    values.push(reqId);
    await pool.query(
        `UPDATE identification_request SET ${fields.join(', ')} WHERE req_id = ?`,
        values
    );
};

/**
 * 删除鉴定请求（硬删除）
 */
const deleteRequest = async (reqId) => {
    await pool.query('DELETE FROM identification_request WHERE req_id = ?', [reqId]);
};

/**
 * 分页查询鉴定请求列表（原始数据，不组装关联对象）
 * @param {object} options - page, pageSize, status, obsId, reviewerId, keyword (搜索 req_species_name)
 */
const list = async ({ page = 1, pageSize = 20, status, obsId, reviewerId, keyword } = {}) => {
    const conditions = [];
    const params = [];

    if (status) {
        conditions.push('status = ?');
        params.push(status);
    }
    if (obsId) {
        conditions.push('obs_id = ?');
        params.push(obsId);
    }
    if (reviewerId) {
        conditions.push('reviewer_id = ?');
        params.push(reviewerId);
    }
    if (keyword) {
        conditions.push('req_species_name LIKE ?');
        params.push(`%${keyword}%`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;

    // 查询列表
    const [rows] = await pool.query(
        `SELECT * FROM identification_request ${whereClause}
         ORDER BY req_id DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
    );

    // 查询总数
    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) as total FROM identification_request ${whereClause}`,
        params
    );

    return { list: rows, total, page, pageSize };
};

module.exports = {
    getById,
    getByObsId,
    create,
    update,
    deleteRequest,
    list,
};