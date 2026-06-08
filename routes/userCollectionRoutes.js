// src/routes/userCollectionRoutes.js
const express = require('express');
const router = express.Router();
const userCollectionController = require('../controllers/userCollectionController');

// 收藏操作
router.post('/', userCollectionController.addCollection);          // 添加收藏
router.delete('/', userCollectionController.removeCollection);     // 取消收藏
router.get('/check', userCollectionController.checkCollected);     // 检查是否收藏

// 用户收藏列表
router.get('/user/:userId', userCollectionController.listUserCollections);
router.get('/user/:userId/species-ids', userCollectionController.getCollectedSpeciesIds);

// 统计接口
router.get('/stats/species/:speciesId', userCollectionController.getCollectionCountBySpecies);
router.get('/stats/user/:userId', userCollectionController.getCollectionCountByUser);

module.exports = router;