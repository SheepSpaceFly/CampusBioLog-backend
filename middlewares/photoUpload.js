// src/middlewares/photoUpload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

//上传观察图片
const obsUploadDir = path.join(__dirname, '../uploads/observation_photos');
if (!fs.existsSync(obsUploadDir)) {
  fs.mkdirSync(obsUploadDir, { recursive: true });
}

const obsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, obsUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `obsPhoto_${uniqueSuffix}${ext}`);
  },
});

const avatarUploadDir = path.join(__dirname, '../uploads/avatar');
if (!fs.existsSync(avatarUploadDir)) {
  fs.mkdirSync(avatarUploadDir, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `avatar_${uniqueSuffix}${ext}`);
  },
});

// 文件过滤：只允许图片
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件'), false);
  }
};

const uploadObs = multer({
  storage: obsStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 限制
});

const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 限制
});

module.exports = {  
    uploadObs,
    uploadAvatar
};