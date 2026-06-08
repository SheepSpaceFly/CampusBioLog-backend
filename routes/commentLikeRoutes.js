// src/routes/commentLikeRoutes.js
const express = require('express');
const router = express.Router();
const commentLikeController = require('../controllers/commentLikeController');

// 点赞 / 取消点赞
router.post('/', commentLikeController.likeComment);
router.delete('/', commentLikeController.unlikeComment);

// 检查是否已点赞
router.get('/check', commentLikeController.checkLiked);

// 获取点赞总数
router.get('/count/:commentId', commentLikeController.getLikeCount);

// 获取用户点赞的所有评论ID
router.get('/user/:userId', commentLikeController.getUserLikedComments);

// 获取点赞某评论的用户ID列表
router.get('/comment/:commentId/users', commentLikeController.getCommentLikedUsers);

module.exports = router;