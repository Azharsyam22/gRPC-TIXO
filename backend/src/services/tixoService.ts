import * as grpc from '@grpc/grpc-js';
import { RowDataPacket } from 'mysql2/promise';
import { pool, withTransaction } from '../config/database';
import { streamManager, TixoStreamCall } from './streamManager';
import {
  IGetDaftarKursiRequest,
  IGetDaftarKursiResponse,
  IPesanKursiRequest,
  IPesanKursiResponse,
  IBatalPesananRequest,
  IBatalPesananResponse,
  ISeat,
  SeatStatus,
} from '../types/tixo';

// Interface baris database untuk tabel seats (Strict typing tanpa 'any')
export interface ISeatDbRow extends RowDataPacket {
  id: string;
  schedule_id: string;
  seat_number: string;
  status: 'AVAILABLE' | 'PENDING' | 'BOOKED';
  updated_at: Date | string;
}

/**
 * Konversi status database MySQL enum ke Protobuf SeatStatus enum
 */
export function mapDbStatusToProto(status: string): SeatStatus {
  switch (status) {
    case 'BOOKED':
      return SeatStatus.BOOKED;
    case 'PENDING':
      return SeatStatus.PENDING;
    case 'AVAILABLE':
    default:
      return SeatStatus.AVAILABLE;
  }
}

/**
 * Konversi status Protobuf SeatStatus enum ke string status database MySQL
 */
export function mapProtoStatusToDb(status: SeatStatus): 'AVAILABLE' | 'PENDING' | 'BOOKED' {
  switch (status) {
    case SeatStatus.BOOKED:
      return 'BOOKED';
    case SeatStatus.PENDING:
      return 'PENDING';
    case SeatStatus.AVAILABLE:
    default:
      return 'AVAILABLE';
  }
}

/**
 * 1. RPC GetDaftarKursi: Mengambil snapshot seluruh status kursi untuk jadwal tertentu
 */
export async function getDaftarKursiHandler(
  call: grpc.ServerUnaryCall<IGetDaftarKursiRequest, IGetDaftarKursiResponse>,
  callback: grpc.sendUnaryData<IGetDaftarKursiResponse>
): Promise<void> {
  const scheduleId = call.request.schedule_id;

  try {
    const [rows] = await pool.execute<ISeatDbRow[]>(
      'SELECT id, schedule_id, seat_number, status, updated_at FROM seats WHERE schedule_id = ? ORDER BY seat_number ASC',
      [scheduleId]
    );

    const seats: ISeat[] = rows.map((row) => ({
      id: row.id,
      schedule_id: row.schedule_id,
      seat_number: row.seat_number,
      status: mapDbStatusToProto(row.status),
      updated_at: typeof row.updated_at === 'string' ? row.updated_at : row.updated_at.toISOString(),
    }));

    callback(null, {
      schedule_id: scheduleId,
      seats,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[TIXO-RPC] Error GetDaftarKursi (${scheduleId}):`, errorMsg);
    callback({
      code: grpc.status.INTERNAL,
      message: `Gagal mengambil daftar kursi: ${errorMsg}`,
    });
  }
}

/**
 * 2. RPC PesanKursi: Memesan kursi dengan proteksi Race Condition menggunakan SELECT ... FOR UPDATE
 */
export async function pesanKursiHandler(
  call: grpc.ServerUnaryCall<IPesanKursiRequest, IPesanKursiResponse>,
  callback: grpc.sendUnaryData<IPesanKursiResponse>
): Promise<void> {
  const { schedule_id, seat_number, user_id, transaction_id } = call.request;

  if (!schedule_id || !seat_number || !user_id || !transaction_id) {
    callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: 'Parameter schedule_id, seat_number, user_id, dan transaction_id wajib diisi.',
    });
    return;
  }

  try {
    // Eksekusi transaksi terisolasi dengan Row-Level Lock
    const result = await withTransaction<IPesanKursiResponse>(async (conn) => {
      // 1. Eksekusi query kuncian baris (Locking Read)
      // Baris ini akan terkunci (Exclusive Lock) sehingga request bersamaan terblokir sampai commit/rollback selesai
      const [rows] = await conn.execute<ISeatDbRow[]>(
        'SELECT id, schedule_id, seat_number, status, updated_at FROM seats WHERE schedule_id = ? AND seat_number = ? FOR UPDATE',
        [schedule_id, seat_number]
      );

      if (rows.length === 0) {
        return {
          success: false,
          message: `Kursi ${seat_number} tidak ditemukan pada jadwal ${schedule_id}.`,
          transaction_id,
        };
      }

      const seatRow = rows[0]!;

      // 2. Evaluasi status ketersediaan kursi
      if (seatRow.status !== 'AVAILABLE') {
        return {
          success: false,
          message: `Pemesanan gagal: Kursi ${seat_number} sudah dipesan atau sedang diproses oleh pengguna lain.`,
          transaction_id,
          seat: {
            id: seatRow.id,
            schedule_id: seatRow.schedule_id,
            seat_number: seatRow.seat_number,
            status: mapDbStatusToProto(seatRow.status),
            updated_at: typeof seatRow.updated_at === 'string' ? seatRow.updated_at : seatRow.updated_at.toISOString(),
          },
        };
      }

      // 3. Status masih AVAILABLE -> Mutasi baris menjadi BOOKED
      await conn.execute(
        'UPDATE seats SET status = "BOOKED", updated_at = NOW() WHERE id = ?',
        [seatRow.id]
      );

      // 4. Catat riwayat bukti transaksi
      await conn.execute(
        'INSERT INTO transactions (transaction_id, seat_id, user_id, status) VALUES (?, ?, ?, ?)',
        [transaction_id, seatRow.id, user_id, 'BOOKED']
      );

      const updatedSeat: ISeat = {
        id: seatRow.id,
        schedule_id: seatRow.schedule_id,
        seat_number: seatRow.seat_number,
        status: SeatStatus.BOOKED,
        updated_at: new Date().toISOString(),
      };

      return {
        success: true,
        message: `Kursi ${seat_number} berhasil dipesan!`,
        transaction_id,
        seat: updatedSeat,
      };
    });

    // 5. Jika transaksi komit dan sukses, siarkan ke seluruh client streaming secara serentak
    if (result.success && result.seat) {
      streamManager.broadcastSeatUpdate(schedule_id, seat_number, SeatStatus.BOOKED);
    }

    callback(null, result);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[TIXO-RPC] Error PesanKursi (${seat_number}):`, errorMsg);
    callback({
      code: grpc.status.INTERNAL,
      message: `Terjadi kegagalan server saat memproses transaksi: ${errorMsg}`,
    });
  }
}

/**
 * 3. RPC PantauStatusKursi: Server Streaming untuk update status real-time
 */
export function pantauStatusKursiHandler(call: TixoStreamCall): void {
  const { schedule_id, client_id } = call.request;

  if (!schedule_id) {
    call.emit('error', {
      code: grpc.status.INVALID_ARGUMENT,
      message: 'Parameter schedule_id wajib disertakan untuk mendengarkan stream.',
    });
    return;
  }

  console.log(`[TIXO-RPC] Klien '${client_id || 'unknown'}' mulai mendengarkan stream jadwal: ${schedule_id}`);
  streamManager.addClient(schedule_id, call);
}

/**
 * 4. RPC BatalPesanan: Mengembalikan status kursi menjadi AVAILABLE
 */
export async function batalPesananHandler(
  call: grpc.ServerUnaryCall<IBatalPesananRequest, IBatalPesananResponse>,
  callback: grpc.sendUnaryData<IBatalPesananResponse>
): Promise<void> {
  const { schedule_id, seat_number, user_id, transaction_id } = call.request;

  if (!schedule_id || !seat_number || !user_id || !transaction_id) {
    callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: 'Parameter schedule_id, seat_number, user_id, dan transaction_id wajib diisi.',
    });
    return;
  }

  try {
    const result = await withTransaction<IBatalPesananResponse>(async (conn) => {
      const [rows] = await conn.execute<ISeatDbRow[]>(
        'SELECT id, schedule_id, seat_number, status, updated_at FROM seats WHERE schedule_id = ? AND seat_number = ? FOR UPDATE',
        [schedule_id, seat_number]
      );

      if (rows.length === 0) {
        return {
          success: false,
          message: `Kursi ${seat_number} tidak ditemukan pada jadwal ${schedule_id}.`,
        };
      }

      const seatRow = rows[0]!;

      if (seatRow.status !== 'BOOKED') {
        return {
          success: false,
          message: `Kursi ${seat_number} tidak dapat dibatalkan karena berstatus ${seatRow.status}.`,
        };
      }

      // Kembalikan ke AVAILABLE
      await conn.execute(
        'UPDATE seats SET status = "AVAILABLE", updated_at = NOW() WHERE id = ?',
        [seatRow.id]
      );

      // Catat log pembatalan
      await conn.execute(
        'INSERT INTO transactions (transaction_id, seat_id, user_id, status) VALUES (?, ?, ?, ?)',
        [`cancel-${transaction_id}`, seatRow.id, user_id, 'CANCELLED']
      );

      const updatedSeat: ISeat = {
        id: seatRow.id,
        schedule_id: seatRow.schedule_id,
        seat_number: seatRow.seat_number,
        status: SeatStatus.AVAILABLE,
        updated_at: new Date().toISOString(),
      };

      return {
        success: true,
        message: `Pemesanan kursi ${seat_number} berhasil dibatalkan.`,
        seat: updatedSeat,
      };
    });

    if (result.success && result.seat) {
      streamManager.broadcastSeatUpdate(schedule_id, seat_number, SeatStatus.AVAILABLE);
    }

    callback(null, result);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[TIXO-RPC] Error BatalPesanan (${seat_number}):`, errorMsg);
    callback({
      code: grpc.status.INTERNAL,
      message: `Gagal membatalkan pesanan: ${errorMsg}`,
    });
  }
}
