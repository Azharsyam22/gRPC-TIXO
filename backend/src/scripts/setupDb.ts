import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '3306', 10);
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '';

async function setupDatabase(): Promise<void> {
  console.log(`[TIXO-DB-SETUP] Menghubungkan ke MySQL di ${dbHost}:${dbPort} (User: ${dbUser})...`);

  // Buat koneksi langsung tanpa memilih database terlebih dahulu
  let connection: mysql.Connection | null = null;
  try {
    connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      multipleStatements: true,
    });

    console.log('[TIXO-DB-SETUP] Berhasil terhubung ke MySQL Server.');

    // Cari file schema.sql secara robust di berbagai kemungkinan lokasi direktori
    const candidateSchemaPaths = [
      path.resolve(__dirname, '../config/schema.sql'),
      path.resolve(__dirname, '../../src/config/schema.sql'),
      path.resolve(__dirname, '../../../database/init.sql'),
      path.resolve(process.cwd(), 'src/config/schema.sql'),
      path.resolve(process.cwd(), '../database/init.sql'),
    ];

    let schemaPath: string | null = null;
    for (const p of candidateSchemaPaths) {
      if (fs.existsSync(p)) {
        schemaPath = p;
        break;
      }
    }

    if (!schemaPath) {
      throw new Error(`File schema.sql atau init.sql tidak ditemukan di: ${candidateSchemaPaths.join(', ')}`);
    }

    const sqlContent = fs.readFileSync(schemaPath, 'utf-8');

    console.log(`[TIXO-DB-SETUP] Mengeksekusi ${schemaPath}...`);
    await connection.query(sqlContent);

    console.log('[TIXO-DB-SETUP] Database "tixo_db" dan tabel-tabel berhasil diinisialisasi beserta 50 data kursi.');
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[TIXO-DB-SETUP] Gagal menginisialisasi database:', errorMsg);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

if (require.main === module) {
  setupDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

