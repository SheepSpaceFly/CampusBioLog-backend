var express = require('express');
const cors = require('cors');

const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

// 路由挂载
const userRoutes = require('./routes/userRoutes');
const locationRoutes = require('./routes/locationRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const speciesRoutes = require('./routes/speciesRoutes');
const observationRoutes = require('./routes/observationRoutes');
const identificationRequestRoutes = require('./routes/identificationRequestRoutes');
const userCollectionRoutes = require('./routes/userCollectionRoutes');
const postRoutes = require('./routes/postRoutes');
const commentRoutes = require('./routes/commentRoutes');
const postLikeRoutes = require('./routes/postLikeRoutes');
const commentLikeRoutes = require('./routes/commentLikeRoutes');

app.use('/uploads', express.static('./uploads'));
app.use('/api/users', userRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/species', speciesRoutes);
app.use('/api/observations', observationRoutes);
app.use('/api/identification-requests', identificationRequestRoutes);
app.use('/api/collections', userCollectionRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/post-likes', postLikeRoutes);
app.use('/api/comment-likes', commentLikeRoutes);

// 统一错误处理
app.use(errorHandler);

module.exports = app;
