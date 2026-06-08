//format.js
// ==================== 统一格式化对象 ====================
/**
 * 将数据库返回的对象转换为前端统一结构
 * - 去掉 password_hash
 * - 驼峰命名
 * - 所有字段保证存在，无值为 null
 */

const formatUser = (dbUser) => {
  if (!dbUser) return null;
  return {
    userId: dbUser.user_id,
    username: dbUser.username || null,
    email: dbUser.email || null,
    role: dbUser.role,
    status: dbUser.status,
    nickname: dbUser.nickname || null,
    avatarUrl: dbUser.avatar_url || null,
    createdAt: dbUser.created_at,
    lastLoginAt: dbUser.last_login_at || null,
  };
};

const formatCategory = (dbCategory) => {
  if (!dbCategory) return null;
  return {
    categoryId: dbCategory.category_id,
    name: dbCategory.name,
    parentId: dbCategory.parent_id ?? null,
  };
};

const formatSpecies = (dbSpecies) => {
  if (!dbSpecies) return null;
  return {
    speciesId: dbSpecies.species_id,
    speciesName: dbSpecies.species_name,
    description: dbSpecies.description || null,
    createdAt: dbSpecies.created_at,
  };
};

const formatLocation = (dbLocation) => {
  if (!dbLocation) return null;
  return {
    locationId: dbLocation.location_id,
    name: dbLocation.name,
    latitude: dbLocation.latitude !== null ? parseFloat(dbLocation.latitude) : null,
    longitude: dbLocation.longitude !== null ? parseFloat(dbLocation.longitude) : null,
    description: dbLocation.description || null,
  };
};

const formatPhoto = (dbPhoto) => {
  if (!dbPhoto) return null;
  return {
    photoId: dbPhoto.photo_id,
    filePath: dbPhoto.file_path,
    previewPath: dbPhoto.preview_path,
    uploadedAt: dbPhoto.uploaded_at,
  };
};

const formatObservation = (dbObs, photosArray = []) => {
  if (!dbObs) return null;
  return {
    obsId: dbObs.obs_id,
    title: dbObs.title,
    content: dbObs.content,
    status: dbObs.status,
    submittedAt: dbObs.submitted_at,
    reviewedAt: dbObs.reviewed_at,
    identifiedAt: dbObs.identified_at,
    user: formatUser({
      user_id: dbObs.user_id,
      username: dbObs.username,
      role: dbObs.u_role,
      status: dbObs.u_status,
      nickname: dbObs.nickname,
      avatar_url: dbObs.avatar_url,
    }),
    species: formatSpecies({
      species_id: dbObs.s_species_id,
      species_name: dbObs.common_name,
      category_id: dbObs.category_id,
      description: dbObs.species_description,
    }),
    location: formatLocation({
      location_id: dbObs.l_location_id,
      name: dbObs.location_name,
      latitude: dbObs.latitude,
      longitude: dbObs.longitude,
      description: dbObs.location_description,
    }),
    photos: (photosArray || []).map(formatPhoto),
  };
};

const formatIdentificationRequest = (dbRequest, fullObservation, fullReviewer, fullResultSpecies) => {
    if (!dbRequest) return null;
    return {
        reqId: dbRequest.req_id,
        observation: fullObservation,
        status: dbRequest.status,
        reviewer: fullReviewer,
        reqSpeciesName: dbRequest.req_species_name || null,
        resultSpecies: fullResultSpecies,
        reviewNote: dbRequest.review_note || null,
    };
};

const formatUserCollection = (dbCollection, fullUser, fullSpecies) => {
    if (!dbCollection) return null;
    return {
        collectionId: dbCollection.collection_id,
        user: fullUser,                
        species: fullSpecies,        
        collectedAt: dbCollection.collected_at,
    };
};

const formatPost = (dbPost, fullObservation) => {
    if (!dbPost) return null;
    return {
        postId: dbPost.post_id,
        observation: fullObservation,
        viewCount: dbPost.view_count,
        priority: dbPost.priority,
        status: dbPost.status,
        createdAt: dbPost.created_at,
        updatedAt: dbPost.updated_at,
    };
};

const formatComment = (dbComment, fullUser) => {
    if (!dbComment) return null;
    return {
        commentId: dbComment.comment_id,
        postId: dbComment.post_id,   
        user: fullUser,             
        parentCommentId: dbComment.parent_comment_id || null,
        content: dbComment.content,
        status: dbComment.status,
        createdAt: dbComment.created_at,
    };
};


module.exports = {
    formatUser,
    formatCategory,
    formatSpecies,
    formatLocation,
    formatObservation,
    formatPhoto,
    formatIdentificationRequest,
    formatUserCollection,
    formatPost,
    formatComment
};