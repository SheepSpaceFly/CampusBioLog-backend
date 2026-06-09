// src/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// 创建通知
router.post('/', notificationController.createNotification);

// 获取通知列表
router.get('/', notificationController.listNotifications);

// 获取未读数量
router.get('/unread-count', notificationController.getUnreadCount);

// 标记单个为已读
router.put('/:notificationId/read', notificationController.markAsRead);

// 标记全部为已读
router.put('/read-all', notificationController.markAllAsRead);

// 删除通知
router.delete('/:notificationId', notificationController.deleteNotification);

module.exports = router;