// src/routes/postLikeRoutes.js
const express = require('express');
const router = express.Router();
const postLikeController = require('../controllers/postLikeController');

// 点赞 / 取消点赞
router.post('/', postLikeController.likePost);
router.delete('/', postLikeController.unlikePost);

// 检查是否已点赞
router.get('/check', postLikeController.checkLiked);

// 获取点赞总数
router.get('/count/:postId', postLikeController.getLikeCount);

// 获取用户点赞的所有帖子ID
router.get('/user/:userId', postLikeController.getUserLikedPosts);

// 获取点赞某帖子的用户ID列表（可用于展示头像）
router.get('/post/:postId/users', postLikeController.getPostLikedUsers);

module.exports = router;