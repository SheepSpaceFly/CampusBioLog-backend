const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

(async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query('SHOW TABLES');
    console.log(`\n✅ 已连接到数据库: ${process.env.DB_NAME}`);
    console.log('📋 当前数据库中的表:');
    rows.forEach(row => {
      const tableName = Object.values(row)[0];
      console.log(`   - ${tableName}`);
    });
    if (rows.length === 0) {
      console.log('   ⚠️ 当前数据库中没有表，请导入 SQL 文件');
    }
  } catch (err) {
    console.error('❌ 数据库连接失败:', err.message);
    console.error('   配置信息:');
    console.error(`   DB_HOST: ${process.env.DB_HOST}`);
    console.error(`   DB_USER: ${process.env.DB_USER}`);
    console.error(`   DB_NAME: ${process.env.DB_NAME}`);
    console.error(`   DB_PASSWORD: ${'*'.repeat((process.env.DB_PASSWORD || '').length)}`);
  } finally {
    if (connection) connection.release();
  }
})();

module.exports = pool;