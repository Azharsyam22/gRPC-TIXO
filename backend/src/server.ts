import * as grpc from '@grpc/grpc-js';
import dotenv from 'dotenv';
import path from 'path';
import { getTixoServiceDefinition } from './config/protoLoader';
import { pool, checkDatabaseConnection } from './config/database';
import { streamManager } from './services/streamManager';
import {
  getDaftarKursiHandler,
  pesanKursiHandler,
  pesanBanyakKursiHandler,
  pantauStatusKursiHandler,
  batalPesananHandler,
  getKatalogFilmHandler,
  getDaftarJadwalHandler,
  signInWithGoogleHandler,
} from './services/tixoService';

// Muat konfigurasi .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const HOST = process.env.GRPC_HOST || '0.0.0.0';
const PORT = process.env.GRPC_PORT || '50051';
const BIND_ADDRESS = `${HOST}:${PORT}`;

export function createTixoServer(): grpc.Server {
  const server = new grpc.Server({
    'grpc.max_receive_message_length': 4 * 1024 * 1024,
    'grpc.max_send_message_length': 4 * 1024 * 1024,
  });

  const serviceDefinition = getTixoServiceDefinition();

  // Daftarkan seluruh implementasi RPC handler
  server.addService(serviceDefinition, {
    GetDaftarKursi: getDaftarKursiHandler,
    PesanKursi: pesanKursiHandler,
    PesanBanyakKursi: pesanBanyakKursiHandler,
    PantauStatusKursi: pantauStatusKursiHandler,
    BatalPesanan: batalPesananHandler,
    GetKatalogFilm: getKatalogFilmHandler,
    GetDaftarJadwal: getDaftarJadwalHandler,
    SignInWithGoogle: signInWithGoogleHandler,
  });

  return server;
}

export async function startServer(): Promise<grpc.Server> {
  const isDbReady = await checkDatabaseConnection();
  if (isDbReady) {
    console.log('[TIXO-DB] Terhubung ke MySQL Database (InnoDB ACID Ready).');
  } else {
    console.warn('[TIXO-DB] Perhatian: Belum terhubung ke MySQL. Pastikan container MySQL berjalan.');
  }

  const server = createTixoServer();

  return new Promise((resolve, reject) => {
    server.bindAsync(
      BIND_ADDRESS,
      grpc.ServerCredentials.createInsecure(),
      (error: Error | null, port: number) => {
        if (error) {
          console.error('[TIXO-SERVER] Gagal melakukan bind ke port:', error);
          reject(error);
          return;
        }

        console.log('====================================================');
        console.log(`TIXO gRPC Server Berjalan di: ${HOST}:${port}`);
        console.log('RPC Services Terdaftar:');
        console.log('   - GetDaftarKursi    (Unary RPC + Film & Pricing Metadata)');
        console.log('   - PesanKursi        (Unary RPC + Row-Level Locking)');
        console.log('   - PesanBanyakKursi  (Unary RPC + Multi-Seat Booking)');
        console.log('   - PantauStatusKursi (Server Streaming RPC)');
        console.log('   - BatalPesanan      (Unary RPC)');
        console.log('   - GetKatalogFilm    (Unary RPC - Multiple Movies)');
        console.log('   - GetDaftarJadwal   (Unary RPC - Weekday 40rb / Weekend 45rb)');
        console.log('   - SignInWithGoogle  (Unary RPC - Gmail Auth)');
        console.log('====================================================');

        resolve(server);
      }
    );
  });
}

// Handler Graceful Shutdown
function setupGracefulShutdown(server: grpc.Server): void {
  const shutdown = (signal: string): void => {
    console.log(`\n[TIXO-SERVER] Menerima sinyal ${signal}. Menutup server secara graceful...`);

    // 1. Bersihkan seluruh active streaming listeners
    streamManager.clearAll();

    // 2. Hentikan gRPC server
    server.tryShutdown((err) => {
      if (err) {
        console.warn('[TIXO-SERVER] Terjadi kendala saat tryShutdown, memaksa forceShutdown:', err);
        server.forceShutdown();
      }

      // 3. Tutup MySQL connection pool
      void pool.end().then(() => {
        console.log('[TIXO-SERVER] MySQL connection pool ditutup. Server berhenti dengan bersih.');
        process.exit(0);
      });
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Jalankan otomatis jika dipanggil langsung sebagai main entry point
if (require.main === module) {
  startServer()
    .then((server) => {
      setupGracefulShutdown(server);
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[TIXO-SERVER] Gagal memulai server:', msg);
      process.exit(1);
    });
}
