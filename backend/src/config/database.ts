import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// Pastikan environment variables terbaca
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '3306', 10);
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '';
const dbName = process.env.DB_NAME || 'tixo_db';
const dbLimit = parseInt(process.env.DB_CONNECTION_LIMIT || '20', 10);

/**
 * Global MySQL Connection Pool
 */
export const pool: Pool = mysql.createPool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  waitForConnections: true,
  connectionLimit: dbLimit,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

/**
 * Mengecek konektivitas database pool.
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[TIXO-DB] Warning: Tidak dapat terhubung ke MySQL (${dbHost}:${dbPort}): ${message}`);
    return false;
  }
}

/**
 * Type-safe Transaction Execution Helper
 * Menjalankan operasi callback di dalam isolasi transaksi MySQL.
 * Secara otomatis melakukan:
 * 1. beginTransaction()
 * 2. commit() jika sukses
 * 3. rollback() jika terjadi exception/error
 * 4. connection.release() pada blok finally
 */
export async function withTransaction<T>(
  callback: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const connection: PoolConnection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result: T = await callback(connection);
    await connection.commit();
    return result;
  } catch (error: unknown) {
    try {
      await connection.rollback();
    } catch (rollbackError: unknown) {
      console.error('[TIXO-DB] Error rolling back transaction:', rollbackError);
    }
    throw error;
  } finally {
    connection.release();
  }
}

