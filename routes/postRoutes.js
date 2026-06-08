// src/routes/postRoutes.js
const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');

// 创建帖子
router.post('/', postController.createPost);

// 获取帖子列表（分页+筛选）
router.get('/', postController.listPosts);

// 根据观测记录ID获取帖子
router.get('/by-obs/:obsId', postController.getPostsByObsId);

// 获取单个帖子（自动增加浏览量）
router.get('/:postId', postController.getPostById);

// 更新帖子
router.put('/:postId', postController.updatePost);

// 软删除帖子
router.delete('/:postId', postController.deletePost);

module.exports = router;