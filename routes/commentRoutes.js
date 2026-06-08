// src/routes/commentRoutes.js
const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');

router.post('/', commentController.createComment);
router.get('/count/:postId', commentController.getCommentCount);
router.get('/by-post/:postId', commentController.getCommentTreeByPost);
router.get('/by-user/:userId', commentController.getCommentsByUser);
router.get('/:commentId', commentController.getCommentById);
router.put('/:commentId', commentController.updateComment);
router.delete('/:commentId', commentController.deleteComment);

module.exports = router;