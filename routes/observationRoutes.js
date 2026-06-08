// src/routes/observationRoutes.js
const express = require('express');
const router = express.Router();
const observationController = require('../controllers/observationController');
const uploadObs = require('../middlewares/photoUpload').uploadObs;

// 统计接口
router.get('/count/user/:userId', observationController.countByUser);
router.get('/count/species/:speciesId', observationController.countBySpecies);

// 列表与用户相关
router.get('/', observationController.listObservations);
router.get('/user/:userId', observationController.getObservationsByUser);

// 创建观测（支持 multipart/form-data，字段名 photos）
router.post('/', uploadObs.array('photos', 10), observationController.createObservation);

// 单条记录操作
router.get('/:obsId', observationController.getObservationById);
router.put('/:obsId', observationController.updateObservation);
router.patch('/:obsId/status', observationController.updateObservationStatus);
router.delete('/:obsId', observationController.deleteObservation);

// 照片子资源
router.delete('/:obsId/photos/:photoId', observationController.deletePhoto);
router.post('/:obsId/photos', uploadObs.array('photos', 10), observationController.addPhotosToObservation);

module.exports = router;