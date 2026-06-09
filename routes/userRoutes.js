// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { uploadAvatar } = require('../middlewares/photoUpload');
const wechatCodeMiddleware = require('../middlewares/wechatAuth');

// ==================== 固定路径（优先级高） ====================

// GET /api/users
router.get('/', userController.listUsers);

router.post('/code', wechatCodeMiddleware, userController.getUserByCode);

// GET /api/users/check-username?username=xxx
router.get('/check-username', userController.checkUsername);

// GET /api/users/check-email?email=xxx
router.get('/check-email', userController.checkEmail);

// GET /api/users/check-openid?openid=xxx
router.get('/check-openid', userController.checkOpenId);

// POST /api/users/wechat
router.post('/wechat', uploadAvatar.single('avatar'), wechatCodeMiddleware, userController.createWechatUser);

// 微信用户登录
router.post('/wechat/login', wechatCodeMiddleware, userController.wechatLogin);

// 管理员登录（使用 username + password，不需要 code）
router.post('/admin/login', userController.adminLogin);

// POST /api/users/admin
router.post('/admin', uploadAvatar.single('avatar'), userController.createAdmin);

// 注意：前端需使用 multipart/form-data，字段名为 "avatar"
router.post('/:id/avatar', uploadAvatar.single('avatar'), userController.updateAvatar);

// ==================== 带 :id 的动态路径（放最后） ====================

// PUT /api/users/:id/profile
router.put('/:id/profile', userController.updateWechatProfile);

// PUT /api/users/:id/admin
router.put('/:id/admin', userController.updateAdminProfile);

// PATCH /api/users/:id/status
router.patch('/:id/status', userController.updateUserStatus);

// PATCH /api/users/:id/role
router.patch('/:id/role', userController.updateUserRole);

// DELETE /api/users/:id
router.delete('/:id', userController.deleteUser);

// GET /api/users/:id （必须放在所有固定路径之后，避免 /check-xxx 被误匹配）
router.get('/:id', userController.getUserById);

module.exports = router;