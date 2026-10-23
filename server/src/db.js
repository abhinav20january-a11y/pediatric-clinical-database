/** MySQL connection pool and the shared commit/rollback transaction helper. */
import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USER || "pediatric_app",
  password: process.env.DB_PASSWORD || "pediatric_app_password",
  database: process.env.DB_NAME || "pediatric_clinic",
  waitForConnections: true,
  connectionLimit: 10,
  timezone: "Z",
  namedPlaceholders: true,
});

/**
 * Execute related writes atomically. Any thrown error rolls back every write;
 * successful work is committed before the pooled connection is released.
 */
export async function transaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
