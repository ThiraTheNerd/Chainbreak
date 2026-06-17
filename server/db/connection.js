import mysql from 'mysql2/promise';
import config from '../config/env.js';
import logger from '../utils/logger.js';

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  namedPlaceholders: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function testConnection() {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.query('SELECT 1');
    console.log('Database connected successfully');
  } catch (error) {
    throw new Error(`Database connection failed: ${error.message}`);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

export default pool;
