// src/controllers/identificationRequestController.js
const identificationRequestModel = require('../models/identificationRequestModel');
const observationModel = require('../models/observationModel');
const userModel = require('../models/userModel');
const speciesModel = require('../models/speciesModel');
const { formatUser, formatSpecies, formatObservation, formatIdentificationRequest } = require('../utils/format');

// ========== 辅助函数：获取完整的观测对象（含照片） ==========
async function getFullObservationById(obsId) {
    if (!obsId) return null;
    const obsRow = await observationModel.getById(obsId);
    if (!obsRow) return null;
    const photos = await observationModel.getPhotosByObsId(obsId);
    return formatObservation(obsRow, photos);
}

// ========== 辅助函数：获取完整用户对象 ==========
async function getFullUserById(userId) {
    if (!userId) return null;
    const user = await userModel.getById(userId);
    return formatUser(user);
}

// ========== 辅助函数：获取完整物种对象 ==========
async function getFullSpeciesById(speciesId) {
    if (!speciesId) return null;
    const species = await speciesModel.getById(speciesId);
    return formatSpecies(species);
}

// ========== 辅助函数：组装完整鉴定请求 ==========
async function getFullRequestById(reqId) {
    const request = await identificationRequestModel.getById(reqId);
    if (!request) return null;

    const fullObs = await getFullObservationById(request.obs_id);
    const fullReviewer = await getFullUserById(request.reviewer_id);
    const fullResultSpecies = await getFullSpeciesById(request.result_species_id);

    return formatIdentificationRequest(request, fullObs, fullReviewer, fullResultSpecies);
}

// ==================== 控制器方法 ====================

/**
 * POST /api/identification-requests
 * 创建鉴定请求（可由普通用户或审阅员发起，提交推测物种名）
 * 请求体: { obsId, reqSpeciesName, reviewNote? }
 */
exports.createRequest = async (req, res, next) => {
    try {
        const { obsId, reqSpeciesName, reviewNote } = req.body;
        if (!obsId) {
            return res.status(400).json({ success: false, message: '缺少观测记录ID' });
        }

        // 检查是否已存在该观测的鉴定请求
        const existing = await identificationRequestModel.getByObsId(obsId);
        if (existing) {
            return res.status(409).json({ success: false, message: '该观测记录已存在鉴定请求' });
        }

        // 检查观测记录是否存在且状态允许创建鉴定请求
        const obs = await observationModel.getById(obsId);
        if (!obs) {
            return res.status(404).json({ success: false, message: '观测记录不存在' });
        }
        // 根据业务需求，允许创建的状态（例如 pending_review, needs_identification）
        if (!['pending_review', 'needs_identification', 'approved'].includes(obs.status)) {
            return res.status(400).json({ success: false, message: '当前观测记录状态无法发起鉴定请求' });
        }

        const newRequest = await identificationRequestModel.create(obsId, reqSpeciesName || null, reviewNote || null);
        const fullRequest = await getFullRequestById(newRequest.req_id);
        res.status(201).json({ success: true, data: fullRequest });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/identification-requests/:reqId
 * 获取单个鉴定请求（自动替换外键为完整对象）
 */
exports.getRequestById = async (req, res, next) => {
    try {
        const reqId = parseInt(req.params.reqId);
        if (isNaN(reqId)) {
            return res.status(400).json({ success: false, message: '请求ID不合法' });
        }
        const fullRequest = await getFullRequestById(reqId);
        if (!fullRequest) {
            return res.status(404).json({ success: false, message: '鉴定请求不存在' });
        }
        res.json({ success: true, data: fullRequest });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/identification-requests
 * 列表查询（分页 + 筛选）
 * 支持 query: page, pageSize, status, obsId, reviewerId, keyword (搜索 req_species_name)
 */
exports.listRequests = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const { status, obsId, reviewerId, keyword } = req.query;

        const result = await identificationRequestModel.list({ page, pageSize, status, obsId, reviewerId, keyword });

        // 将每个请求组装为完整对象
        const fullList = [];
        for (const reqItem of result.list) {
            const full = await getFullRequestById(reqItem.req_id);
            if (full) fullList.push(full);
        }

        res.json({
            success: true,
            data: {
                list: fullList,
                total: result.total,
                page: result.page,
                pageSize: result.pageSize,
            },
        });
    } catch (err) {
        next(err);
    }
};

/**
 * PUT /api/identification-requests/:reqId
 * 更新鉴定请求（主要用于审阅员执行鉴定或拒绝）
 * 可修改字段: status, reqSpeciesName, resultSpeciesId, reviewNote, reviewerId
 * - 若 status 变为 'identified'，同时更新观测记录的 species_id 和 identified_at
 * - 若 status 变为 'rejected'，仅记录拒绝原因
 */
exports.updateRequest = async (req, res, next) => {
    try {
        const reqId = parseInt(req.params.reqId);
        if (isNaN(reqId)) {
            return res.status(400).json({ success: false, message: '请求ID不合法' });
        }

        const existing = await identificationRequestModel.getById(reqId);
        if (!existing) {
            return res.status(404).json({ success: false, message: '鉴定请求不存在' });
        }

        const { status, reqSpeciesName, resultSpeciesId, reviewNote, reviewerId } = req.body;

        const updateData = {};
        if (status !== undefined) updateData.status = status;
        if (reqSpeciesName !== undefined) updateData.req_species_name = reqSpeciesName;
        if (resultSpeciesId !== undefined) updateData.result_species_id = resultSpeciesId;
        if (reviewNote !== undefined) updateData.review_note = reviewNote;
        if (reviewerId !== undefined) updateData.reviewer_id = reviewerId;

        await identificationRequestModel.update(reqId, updateData);

        // 额外逻辑：如果状态变为 identified 且提供了结果物种，则更新观测记录的物种及鉴定时间
        if (status === 'identified' && resultSpeciesId) {
            const request = await identificationRequestModel.getById(reqId);
            const obsId = request.obs_id;
            // 更新 observation 表的 species_id 和 identified_at
            await observationModel.updateObservation(obsId, { species_id: resultSpeciesId });
            // 同时更新状态为 identified 并设置 identified_at
            await observationModel.updateStatus(obsId, 'identified');
        }

        const fullUpdated = await getFullRequestById(reqId);
        res.json({ success: true, data: fullUpdated });
    } catch (err) {
        next(err);
    }
};

/**
 * DELETE /api/identification-requests/:reqId
 * 删除鉴定请求（硬删除）
 * 权限：管理员
 */
exports.deleteRequest = async (req, res, next) => {
    try {
        const reqId = parseInt(req.params.reqId);
        if (isNaN(reqId)) {
            return res.status(400).json({ success: false, message: '请求ID不合法' });
        }
        const existing = await identificationRequestModel.getById(reqId);
        if (!existing) {
            return res.status(404).json({ success: false, message: '鉴定请求不存在' });
        }
        await identificationRequestModel.deleteRequest(reqId);
        res.json({ success: true, message: '鉴定请求已删除' });
    } catch (err) {
        next(err);
    }
};