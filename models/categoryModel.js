// src/models/categoryModel.js
const pool = require('../config/db');

// ==================== 基础查询 ====================

/** 检查分类是否存在 */
const exists = async (categoryId) => {
  const [[{ cnt }]] = await pool.query(
    'SELECT COUNT(*) as cnt FROM category WHERE category_id = ?',
    [categoryId]
  );
  return cnt > 0;
};

/** 根据ID获取分类信息 */
const getById = async (categoryId) => {
  const [rows] = await pool.query(
    'SELECT * FROM category WHERE category_id = ?',
    [categoryId]
  );
  console.log(categoryId, rows);
  return rows[0];
};

/** 获取所有分类（平铺列表，按ID排序） */
const getAllFlat = async () => {
  const [rows] = await pool.query(
    'SELECT * FROM category ORDER BY category_id'
  );
  return rows;
};

/** 获取直接子分类列表 */
const getChildren = async (parentId) => {
  const [rows] = await pool.query(
    'SELECT * FROM category WHERE parent_id = ? ORDER BY category_id',
    [parentId]
  );
  return rows;
};

/** 判断分类是否有子分类 */
const hasChildren = async (categoryId) => {
  const [[{ cnt }]] = await pool.query(
    'SELECT COUNT(*) as cnt FROM category WHERE parent_id = ?',
    [categoryId]
  );
  return cnt > 0;
};

// ==================== 树形结构操作 ====================

/**
 * 获取某个分类的所有后代（不包含自身）
 * 使用递归CTE查询
 */
const getDescendants = async (categoryId, includeSelf = false) => {
  const [rows] = await pool.query(
    `WITH RECURSIVE cte AS (
       SELECT category_id, name, parent_id FROM category WHERE category_id = ?
       UNION ALL
       SELECT c.category_id, c.name, c.parent_id
       FROM category c
       INNER JOIN cte ON c.parent_id = cte.category_id
     )
     SELECT * FROM cte ${includeSelf ? '' : 'WHERE category_id != ?'}`,
    includeSelf ? [categoryId] : [categoryId, categoryId]
  );
  return rows;
};

/**
 * 获取从根节点到当前节点的路径
 * 返回节点数组（从根到当前）
 */
const getPath = async (categoryId) => {
  const [rows] = await pool.query(
    `WITH RECURSIVE cte AS (
       SELECT category_id, name, parent_id, 0 as level FROM category WHERE category_id = ?
       UNION ALL
       SELECT c.category_id, c.name, c.parent_id, cte.level - 1
       FROM category c
       INNER JOIN cte ON c.category_id = cte.parent_id
     )
     SELECT * FROM cte ORDER BY level ASC`,
    [categoryId]
  );
  return rows;
};

/**
 * 检查移动分类是否会形成循环依赖
 * @param {number} categoryId 要移动的分类ID
 * @param {number|null} newParentId 新的父分类ID
 */
const checkCyclic = async (categoryId, newParentId) => {
  if (newParentId === null) return false; // 移到根节点不会循环
  const descendants = await getDescendants(categoryId, true);
  return descendants.some(d => d.category_id === newParentId);
};

/**
 * 移动分类（修改parent_id）
 * 调用前需先进行循环检查
 */
const updateParent = async (categoryId, newParentId) => {
  await pool.query(
    'UPDATE category SET parent_id = ? WHERE category_id = ?',
    [newParentId, categoryId]
  );
};

/**
 * 获取整棵树（嵌套结构）
 * @param {number|null} rootId 指定根分类ID，不传则获取所有根分类的森林
 */
const getTree = async (rootId = null) => {
  let flatList;
  if (rootId !== null) {
    // 获取指定根及其所有后代
    flatList = await getDescendants(rootId, true);
  } else {
    flatList = await getAllFlat();
  }

  // 构建 id -> node 映射
  const nodeMap = new Map();
  const roots = [];

  flatList.forEach(node => {
    nodeMap.set(node.category_id, { ...node, children: [] });
  });

  flatList.forEach(node => {
    const mappedNode = nodeMap.get(node.category_id);
    if (node.parent_id === null || (rootId !== null && node.category_id === rootId)) {
      roots.push(mappedNode);
    } else {
      const parent = nodeMap.get(node.parent_id);
      if (parent) {
        parent.children.push(mappedNode);
      } else {
        // 父节点不在当前结果集中（可能因rootId限制），作为根节点
        roots.push(mappedNode);
      }
    }
  });

  return roots;
};

// ==================== 创建/更新/删除 ====================

/**
 * 创建分类
 * @param {string} name 分类名称
 * @param {number|null} parentId 父分类ID
 */
const create = async (name, parentId = null) => {
  const [result] = await pool.query(
    'INSERT INTO category (name, parent_id) VALUES (?, ?)',
    [name, parentId]
  );
  return { category_id: result.insertId, name, parent_id: parentId };
};

/**
 * 更新分类
 * @param {number} categoryId
 * @param {string} name 新名称
 * @param {number|null} parentId 新父ID（可选，不传则不修改）
 */
const update = async (categoryId, { name, parentId }) => {
  const updates = [];
  const values = [];
  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (parentId !== undefined) {
    updates.push('parent_id = ?');
    values.push(parentId);
  }
  if (updates.length === 0) return;
  values.push(categoryId);
  await pool.query(`UPDATE category SET ${updates.join(', ')} WHERE category_id = ?`, values);
};

/**
 * 删除分类（会先检查是否有子分类，如果有则拒绝删除）
 * @throws {Error} 如果分类有子分类则抛出错误
 */
const deleteCategory = async (categoryId) => {
  if (await hasChildren(categoryId)) {
    throw new Error('该分类下存在子分类，请先删除子分类');
  }
  await pool.query('DELETE FROM category WHERE category_id = ?', [categoryId]);
};

// ==================== 名称唯一性校验 ====================

/**
 * 检查同一父分类下名称是否已存在
 * @param {string} name 分类名称
 * @param {number|null} parentId 父分类ID
 * @param {number} excludeId 排除的分类ID（用于更新时排除自身）
 */
const isNameUnderParentExists = async (name, parentId, excludeId = null) => {
  let sql = 'SELECT COUNT(*) as cnt FROM category WHERE name = ? AND parent_id ';
  const params = [name];
  if (parentId === null) {
  sql += 'IS NULL';
  } else {
  sql += '= ?';
  params.push(parentId);
  }
  if (excludeId !== null) {
    sql += ' AND category_id != ?';
    params.push(excludeId);
  }
  const [[{ cnt }]] = await pool.query(sql, params);
  return cnt > 0;
};

// ==================== 分页列表（后台管理用） ====================

/**
 * 获取分类列表（平铺分页，支持按父分类过滤）
 * @param {Object} options - { page, pageSize, parentId }
 */
const listCategories = async ({ page = 1, pageSize = 20, parentId } = {}) => {
  const conditions = [];
  const values = [];

  if (parentId !== undefined) {
    if (parentId === null) {
      conditions.push('parent_id IS NULL');
    } else {
      conditions.push('parent_id = ?');
      values.push(parentId);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;

  const [rows] = await pool.query(
    `SELECT * FROM category ${whereClause}
     ORDER BY category_id DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  );

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM category ${whereClause}`,
    values
  );

  return {
    list: rows,
    total,
    page,
    pageSize,
  };
};

module.exports = {
  exists,
  getById,
  getAllFlat,
  getChildren,
  hasChildren,
  getDescendants,
  getPath,
  checkCyclic,
  updateParent,
  getTree,
  create,
  update,
  deleteCategory,
  isNameUnderParentExists,
  listCategories,
};