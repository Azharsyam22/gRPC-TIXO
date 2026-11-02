import * as grpc from '@grpc/grpc-js';
import { v4 as uuidv4 } from 'uuid';
import { getTixoClientConstructor } from '../config/protoLoader';
import {
  IPesanKursiRequest,
  IPesanKursiResponse,
  IPantauStatusRequest,
  IStatusKursiUpdate,
  SeatStatus,
} from '../types/tixo';

interface ITixoGrpcClient extends grpc.Client {
  PesanKursi(
    argument: IPesanKursiRequest,
    callback: (error: grpc.ServiceError | null, response: IPesanKursiResponse) => void
  ): grpc.ClientUnaryCall;
  PantauStatusKursi(argument: IPantauStatusRequest): grpc.ClientReadableStream<IStatusKursiUpdate>;
}

interface ISimulationResult {
  userId: string;
  transactionId: string;
  success: boolean;
  message: string;
  latencyMs: number;
}

const SERVER_ADDRESS = process.env.GRPC_SERVER_ADDRESS || 'localhost:50051';
const TARGET_SCHEDULE = 'sch-01';
const TARGET_SEAT = 'A1';
const TOTAL_CONCURRENT_USERS = 5;

/**
 * Promisified PesanKursi helper untuk pemanggilan gRPC unary
 */
function sendBookingRequest(
  client: ITixoGrpcClient,
  request: IPesanKursiRequest
): Promise<ISimulationResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    client.PesanKursi(request, (error: grpc.ServiceError | null, response: IPesanKursiResponse) => {
      const latencyMs = Date.now() - startTime;

      if (error) {
        resolve({
          userId: request.user_id,
          transactionId: request.transaction_id,
          success: false,
          message: `gRPC Error (${error.code}): ${error.details || error.message}`,
          latencyMs,
        });
        return;
      }

      resolve({
        userId: request.user_id,
        transactionId: request.transaction_id,
        success: response.success,
        message: response.message,
        latencyMs,
      });
    });
  });
}

/**
 * Menjalankan simulasi Race Condition / Tiket War
 */
export async function runRaceConditionSimulation(): Promise<boolean> {
  console.log('================================================================');
  console.log('TIXO BACKEND RACE CONDITION CONCURRENCY SIMULATOR');
  console.log(`Target Jadwal : ${TARGET_SCHEDULE}`);
  console.log(`Target Kursi  : ${TARGET_SEAT}`);
  console.log(`Jumlah Klien  : ${TOTAL_CONCURRENT_USERS} Pengguna Simultan (Promise.all)`);
  console.log(`Alamat Server : ${SERVER_ADDRESS}`);
  console.log('================================================================\n');

  const ClientConstructor = getTixoClientConstructor();
  const client = new ClientConstructor(
    SERVER_ADDRESS,
    grpc.credentials.createInsecure()
  ) as unknown as ITixoGrpcClient;

  // 1. Hubungkan ke Stream PantauStatusKursi untuk memverifikasi real-time broadcast
  console.log('[SIMULATOR] Membuka listener stream PantauStatusKursi...');
  const stream = client.PantauStatusKursi({
    schedule_id: TARGET_SCHEDULE,
    client_id: 'simulator-listener',
  });

  const streamReceivedEvents: IStatusKursiUpdate[] = [];

  stream.on('data', (update: IStatusKursiUpdate) => {
    console.log(
      `[STREAM EVENT] Kursi: ${update.seat_number} | Status Baru: ${SeatStatus[update.status]} | Timestamp: ${update.timestamp}`
    );
    streamReceivedEvents.push(update);
  });

  stream.on('error', (err: Error) => {
    console.warn(`[STREAM WARNING] ${err.message}`);
  });

  // Beri jeda 500ms agar koneksi stream terhubung dengan mantap
  await new Promise((resolve) => setTimeout(resolve, 500));

  // 2. Siapkan 5 request dengan identitas unik tapi mengincar kursi yang sama
  const requests: IPesanKursiRequest[] = [];
  for (let i = 1; i <= TOTAL_CONCURRENT_USERS; i++) {
    requests.push({
      schedule_id: TARGET_SCHEDULE,
      seat_number: TARGET_SEAT,
      user_id: `user-simulasi-${i}`,
      transaction_id: uuidv4(),
    });
  }

  console.log(`\nMenembakkan ${TOTAL_CONCURRENT_USERS} request PesanKursi secara BERSAMAAN ke kursi ${TARGET_SEAT}...\n`);

  // 3. Tembak seluruh request secara simultan menggunakan Promise.all
  const results: ISimulationResult[] = await Promise.all(
    requests.map((req) => sendBookingRequest(client, req))
  );

  // Beri jeda 500ms untuk menangkap event stream terakhir
  await new Promise((resolve) => setTimeout(resolve, 500));

  // 4. Analisis Hasil Simulasi
  const successList = results.filter((r) => r.success);
  const rejectedList = results.filter((r) => !r.success);

  console.log('----------------------------------------------------------------');
  console.log('DETAIL HASIL EKSEKUSI PER REQUEST:');
  console.log('----------------------------------------------------------------');
  results.forEach((r, idx) => {
    const statusText = r.success ? '[SUKSES]' : '[DITOLAK]';
    console.log(
      `[#${idx + 1}] ${r.userId} | ${statusText} (${r.latencyMs}ms) -> ${r.message}`
    );
  });

  console.log('\n================================================================');
  console.log('KESIMPULAN UJI KONKURENSI (RACE CONDITION PROOF):');
  console.log('================================================================');
  console.log(`Total Request Terkirim  : ${results.length}`);
  console.log(`Total Sukses (Booked)   : ${successList.length} (Harus tepat 1)`);
  console.log(`Total Ditolak (Safe)    : ${rejectedList.length} (Harus tepat ${TOTAL_CONCURRENT_USERS - 1})`);
  console.log(`Event Broadcast Diterima: ${streamReceivedEvents.length} event`);

  let testPassed = false;
  if (successList.length === 1 && rejectedList.length === TOTAL_CONCURRENT_USERS - 1) {
    console.log('\n[PASS] RACE CONDITION TERCEGAH DENGAN SEMPURNA');
    console.log('Mekanisme Row-Level Locking (SELECT ... FOR UPDATE) berhasil menjaga integritas data.');
    console.log(`Pemenang Kursi: ${successList[0]?.userId} (Transaction ID: ${successList[0]?.transactionId})`);
    testPassed = true;
  } else {
    console.error('\n[FAIL] TERJADI KORUPSI DATA / DOUBLE BOOKING ATAU KONEKSI SERVER GAGAL');
    testPassed = false;
  }
  console.log('================================================================\n');

  // Bersihkan stream dan client
  stream.cancel();
  client.close();

  return testPassed;
}

// Jalankan otomatis jika dieksekusi langsung
if (require.main === module) {
  runRaceConditionSimulation()
    .then((passed) => {
      process.exit(passed ? 0 : 1);
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[SIMULATOR] Error tak terduga:', msg);
      process.exit(1);
    });
}

