import * as grpc from '@grpc/grpc-js';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2/promise';
import { pool, withTransaction } from '../config/database';
import { streamManager, TixoStreamCall } from './streamManager';
import {
  IGetDaftarKursiRequest,
  IGetDaftarKursiResponse,
  IPesanKursiRequest,
  IPesanKursiResponse,
  IPesanBanyakKursiRequest,
  IPesanBanyakKursiResponse,
  IBatalPesananRequest,
  IBatalPesananResponse,
  IGetKatalogFilmRequest,
  IGetKatalogFilmResponse,
  IGetDaftarJadwalRequest,
  IGetDaftarJadwalResponse,
  IGoogleSignInRequest,
  IGoogleSignInResponse,
  ISeat,
  IScheduleDetail,
  IMovie,
  IUserProfile,
  SeatStatus,
} from '../types/tixo';

// Database row interfaces (strictly typed without any)
export interface ISeatDbRow extends RowDataPacket {
  id: string;
  schedule_id: string;
  seat_number: string;
  status: 'AVAILABLE' | 'PENDING' | 'BOOKED';
  updated_at: Date | string;
}

export interface IScheduleDbRow extends RowDataPacket {
  id: string;
  movie_id: string;
  movie_name: string;
  studio_name: string;
  start_time: Date | string;
  base_price: number;
  created_at: Date | string;
}

export interface IMovieDbRow extends RowDataPacket {
  id: string;
  title: string;
  edition: string;
  genre: string;
  duration_minutes: number;
  poster_url: string | null;
  synopsis: string | null;
  rating: string;
  default_studio: string;
}

export interface IUserDbRow extends RowDataPacket {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  google_id: string | null;
  created_at: Date | string;
}

export interface IIdempotencyDbRow extends RowDataPacket {
  key_id: string;
  request_hash: string;
  response_payload: string | { [key: string]: unknown };
  created_at: Date | string;
}

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

export function generateRequestHash(payload: string): string {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Aturan Bisnis Bioskop:
 * - Hari Biasa (Senin - Jumat): base_price (Rp 40.000)
 * - Akhir Pekan (Sabtu & Minggu): base_price + Rp 5.000 (Rp 45.000)
 */
export function calculateSchedulePricing(startTimeRaw: Date | string, basePrice: number = 40000): {
  isWeekend: boolean;
  ticketPrice: number;
  dateFormatted: string;
  timeFormatted: string;
  startTimeIso: string;
} {
  const dateObj = new Date(startTimeRaw);
  const day = dateObj.getDay(); // 0 = Minggu, 6 = Sabtu
  const isWeekend = day === 0 || day === 6;
  const ticketPrice = isWeekend ? basePrice + 5000 : basePrice;

  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  const dayName = days[day] ?? 'Hari';
  const dayNum = dateObj.getDate();
  const monthName = months[dateObj.getMonth()] ?? '';
  const year = dateObj.getFullYear();
  const dateFormatted = `${dayName}, ${dayNum} ${monthName} ${year}`;

  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const timeFormatted = `${hours}.${minutes} WIB`;

  const startTimeIso = typeof startTimeRaw === 'string' ? startTimeRaw : dateObj.toISOString();

  return { isWeekend, ticketPrice, dateFormatted, timeFormatted, startTimeIso };
}

/**
 * 1. RPC GetDaftarKursi: Snapshot status kursi + Metadata Jadwal, Film, & Harga
 */
export async function getDaftarKursiHandler(
  call: grpc.ServerUnaryCall<IGetDaftarKursiRequest, IGetDaftarKursiResponse>,
  callback: grpc.sendUnaryData<IGetDaftarKursiResponse>
): Promise<void> {
  const scheduleId = call.request.schedule_id;

  try {
    const [seatRows] = await pool.execute<ISeatDbRow[]>(
      'SELECT id, schedule_id, seat_number, status, updated_at FROM seats WHERE schedule_id = ? ORDER BY seat_number ASC',
      [scheduleId]
    );

    const seats: ISeat[] = seatRows.map((row) => ({
      id: row.id,
      schedule_id: row.schedule_id,
      seat_number: row.seat_number,
      status: mapDbStatusToProto(row.status),
      updated_at: typeof row.updated_at === 'string' ? row.updated_at : row.updated_at.toISOString(),
    }));

    // Ambil metadata jadwal dan harga tiket
    const [scheduleRows] = await pool.execute<IScheduleDbRow[]>(
      'SELECT id, movie_id, movie_name, studio_name, start_time, base_price FROM schedules WHERE id = ?',
      [scheduleId]
    );

    let scheduleDetail: IScheduleDetail | undefined = undefined;
    if (scheduleRows.length > 0) {
      const s = scheduleRows[0]!;
      const pricing = calculateSchedulePricing(s.start_time, s.base_price || 40000);

      scheduleDetail = {
        id: s.id,
        movie_id: s.movie_id,
        movie_name: s.movie_name,
        studio_name: s.studio_name,
        start_time: pricing.startTimeIso,
        date_formatted: pricing.dateFormatted,
        time_formatted: pricing.timeFormatted,
        base_price: s.base_price || 40000,
        ticket_price: pricing.ticketPrice,
        is_weekend: pricing.isWeekend,
      };
    }

    callback(null, {
      schedule_id: scheduleId,
      seats,
      schedule: scheduleDetail,
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
 * 2. RPC PesanKursi (Single Seat) dengan kalkulasi harga & Row-Level Locking
 */
export async function pesanKursiHandler(
  call: grpc.ServerUnaryCall<IPesanKursiRequest, IPesanKursiResponse>,
  callback: grpc.sendUnaryData<IPesanKursiResponse>
): Promise<void> {
  const { schedule_id, seat_number, user_id, transaction_id, user_email } = call.request;

  if (!schedule_id || !seat_number || !user_id || !transaction_id) {
    callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: 'Parameter schedule_id, seat_number, user_id, dan transaction_id wajib diisi.',
    });
    return;
  }

  const requestHash = generateRequestHash(`${schedule_id}:${seat_number}:${user_id}`);

  try {
    const result = await withTransaction<IPesanKursiResponse>(async (conn) => {
      // 1. Cek idempotensi tanpa locking read untuk menghindari gap-lock
      const [idempotencyRows] = await conn.execute<IIdempotencyDbRow[]>(
        'SELECT key_id, request_hash, response_payload FROM idempotency_keys WHERE key_id = ?',
        [transaction_id]
      );

      if (idempotencyRows.length > 0) {
        const cachedRow = idempotencyRows[0]!;
        const cachedPayload = typeof cachedRow.response_payload === 'string'
          ? (JSON.parse(cachedRow.response_payload) as IPesanKursiResponse)
          : (cachedRow.response_payload as unknown as IPesanKursiResponse);
        return cachedPayload;
      }

      // 2. Ambil informasi jadwal untuk menentukan harga tiket
      const [scheduleRows] = await conn.execute<IScheduleDbRow[]>(
        'SELECT id, start_time, base_price FROM schedules WHERE id = ?',
        [schedule_id]
      );

      const basePrice = scheduleRows[0]?.base_price || 40000;
      const startTime = scheduleRows[0]?.start_time || new Date();
      const pricing = calculateSchedulePricing(startTime, basePrice);

      // 3. Kunci baris kursi spesifik (Row-Level Lock)
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

      if (seatRow.status !== 'AVAILABLE') {
        const failureResponse: IPesanKursiResponse = {
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

        await conn.execute(
          'INSERT INTO idempotency_keys (key_id, request_hash, response_payload) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE response_payload = VALUES(response_payload)',
          [transaction_id, requestHash, JSON.stringify(failureResponse)]
        );

        return failureResponse;
      }

      // 4. Update status kursi ke BOOKED
      await conn.execute(
        'UPDATE seats SET status = "BOOKED", updated_at = NOW() WHERE id = ?',
        [seatRow.id]
      );

      // 5. Catat riwayat transaksi dengan harga yang dibayar (price_paid)
      await conn.execute(
        'INSERT INTO transactions (transaction_id, seat_id, user_id, user_email, price_paid, status) VALUES (?, ?, ?, ?, ?, ?)',
        [transaction_id, seatRow.id, user_id, user_email || null, pricing.ticketPrice, 'BOOKED']
      );

      const updatedSeat: ISeat = {
        id: seatRow.id,
        schedule_id: seatRow.schedule_id,
        seat_number: seatRow.seat_number,
        status: SeatStatus.BOOKED,
        updated_at: new Date().toISOString(),
      };

      const successResponse: IPesanKursiResponse = {
        success: true,
        message: `Kursi ${seat_number} berhasil dipesan! (Tarif: Rp ${pricing.ticketPrice.toLocaleString('id-ID')})`,
        transaction_id,
        seat: updatedSeat,
        price_paid: pricing.ticketPrice,
      };

      await conn.execute(
        'INSERT INTO idempotency_keys (key_id, request_hash, response_payload) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE response_payload = VALUES(response_payload)',
        [transaction_id, requestHash, JSON.stringify(successResponse)]
      );

      return successResponse;
    });

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
 * 3. RPC PesanBanyakKursi (Batch Booking): Memesan banyak kursi sekaligus
 * Total harga dihitung otomatis (jumlah kursi * harga weekday 40rb / weekend 45rb)
 */
export async function pesanBanyakKursiHandler(
  call: grpc.ServerUnaryCall<IPesanBanyakKursiRequest, IPesanBanyakKursiResponse>,
  callback: grpc.sendUnaryData<IPesanBanyakKursiResponse>
): Promise<void> {
  const { schedule_id, seat_numbers, user_id, user_email, transaction_id } = call.request;

  if (!schedule_id || !seat_numbers || seat_numbers.length === 0 || !user_id || !transaction_id) {
    callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: 'Parameter schedule_id, seat_numbers (minimal 1), user_id, dan transaction_id wajib diisi.',
    });
    return;
  }

  // Urutkan nomor kursi secara alfabetis untuk mencegah potensi database deadlock saat multiple concurrent batch locks
  const sortedSeatNumbers = [...new Set(seat_numbers)].sort();
  const requestHash = generateRequestHash(`${schedule_id}:${sortedSeatNumbers.join(',')}:${user_id}`);

  try {
    const result = await withTransaction<IPesanBanyakKursiResponse>(async (conn) => {
      // 1. Cek idempotensi
      const [idempotencyRows] = await conn.execute<IIdempotencyDbRow[]>(
        'SELECT key_id, response_payload FROM idempotency_keys WHERE key_id = ?',
        [transaction_id]
      );

      if (idempotencyRows.length > 0) {
        const cachedRow = idempotencyRows[0]!;
        const cachedPayload = typeof cachedRow.response_payload === 'string'
          ? (JSON.parse(cachedRow.response_payload) as IPesanBanyakKursiResponse)
          : (cachedRow.response_payload as unknown as IPesanBanyakKursiResponse);
        return cachedPayload;
      }

      // 2. Ambil harga jadwal
      const [scheduleRows] = await conn.execute<IScheduleDbRow[]>(
        'SELECT id, start_time, base_price FROM schedules WHERE id = ?',
        [schedule_id]
      );

      const basePrice = scheduleRows[0]?.base_price || 40000;
      const startTime = scheduleRows[0]?.start_time || new Date();
      const pricing = calculateSchedulePricing(startTime, basePrice);
      const pricePerTicket = pricing.ticketPrice;
      const totalPrice = sortedSeatNumbers.length * pricePerTicket;

      // 3. Kunci seluruh baris kursi yang diminta secara serentak
      const placeholders = sortedSeatNumbers.map(() => '?').join(',');
      const [seatRows] = await conn.execute<ISeatDbRow[]>(
        `SELECT id, schedule_id, seat_number, status FROM seats WHERE schedule_id = ? AND seat_number IN (${placeholders}) ORDER BY seat_number ASC FOR UPDATE`,
        [schedule_id, ...sortedSeatNumbers]
      );

      // Pastikan semua kursi ditemukan
      if (seatRows.length !== sortedSeatNumbers.length) {
        const foundNumbers = seatRows.map((s) => s.seat_number);
        const missingNumbers = sortedSeatNumbers.filter((n) => !foundNumbers.includes(n));
        return {
          success: false,
          message: `Kursi tidak ditemukan: ${missingNumbers.join(', ')}`,
          seats: [],
          total_price: 0,
          price_per_ticket: pricePerTicket,
          transaction_id,
        };
      }

      // Validasi bahwa seluruh kursi masih AVAILABLE
      const unavailableSeats = seatRows.filter((s) => s.status !== 'AVAILABLE');
      if (unavailableSeats.length > 0) {
        const unavailableNumbers = unavailableSeats.map((s) => s.seat_number).join(', ');
        const failResponse: IPesanBanyakKursiResponse = {
          success: false,
          message: `Pemesanan gagal: Kursi [${unavailableNumbers}] sudah tidak tersedia.`,
          seats: seatRows.map((r) => ({
            id: r.id,
            schedule_id: r.schedule_id,
            seat_number: r.seat_number,
            status: mapDbStatusToProto(r.status),
            updated_at: new Date().toISOString(),
          })),
          total_price: 0,
          price_per_ticket: pricePerTicket,
          transaction_id,
        };

        await conn.execute(
          'INSERT INTO idempotency_keys (key_id, request_hash, response_payload) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE response_payload = VALUES(response_payload)',
          [transaction_id, requestHash, JSON.stringify(failResponse)]
        );

        return failResponse;
      }

      // 4. Update seluruh kursi menjadi BOOKED
      const seatIds = seatRows.map((s) => s.id);
      const updatePlaceholders = seatIds.map(() => '?').join(',');
      await conn.execute(
        `UPDATE seats SET status = "BOOKED", updated_at = NOW() WHERE id IN (${updatePlaceholders})`,
        seatIds
      );

      // 5. Catat riwayat transaksi per tiket
      for (const seat of seatRows) {
        const subTxId = `${transaction_id}-${seat.seat_number}`;
        await conn.execute(
          'INSERT INTO transactions (transaction_id, seat_id, user_id, user_email, price_paid, status) VALUES (?, ?, ?, ?, ?, ?)',
          [subTxId, seat.id, user_id, user_email || null, pricePerTicket, 'BOOKED']
        );
      }

      const bookedSeats: ISeat[] = seatRows.map((s) => ({
        id: s.id,
        schedule_id: s.schedule_id,
        seat_number: s.seat_number,
        status: SeatStatus.BOOKED,
        updated_at: new Date().toISOString(),
      }));

      const successResponse: IPesanBanyakKursiResponse = {
        success: true,
        message: `Berhasil memesan ${bookedSeats.length} kursi! Total: Rp ${totalPrice.toLocaleString('id-ID')}`,
        seats: bookedSeats,
        total_price: totalPrice,
        price_per_ticket: pricePerTicket,
        transaction_id,
      };

      await conn.execute(
        'INSERT INTO idempotency_keys (key_id, request_hash, response_payload) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE response_payload = VALUES(response_payload)',
        [transaction_id, requestHash, JSON.stringify(successResponse)]
      );

      return successResponse;
    });

    if (result.success && result.seats.length > 0) {
      for (const bookedSeat of result.seats) {
        streamManager.broadcastSeatUpdate(schedule_id, bookedSeat.seat_number, SeatStatus.BOOKED);
      }
    }

    callback(null, result);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[TIXO-RPC] Error PesanBanyakKursi:', errorMsg);
    callback({
      code: grpc.status.INTERNAL,
      message: `Gagal memproses pemesanan batch: ${errorMsg}`,
    });
  }
}

/**
 * 4. RPC PantauStatusKursi: Server Streaming
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
 * 5. RPC BatalPesanan
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

  const cancelKey = `cancel-${transaction_id}`;
  const requestHash = generateRequestHash(`cancel:${schedule_id}:${seat_number}:${user_id}`);

  try {
    const result = await withTransaction<IBatalPesananResponse>(async (conn) => {
      const [idempotencyRows] = await conn.execute<IIdempotencyDbRow[]>(
        'SELECT key_id, response_payload FROM idempotency_keys WHERE key_id = ?',
        [cancelKey]
      );

      if (idempotencyRows.length > 0) {
        const cachedRow = idempotencyRows[0]!;
        const cachedPayload = typeof cachedRow.response_payload === 'string'
          ? (JSON.parse(cachedRow.response_payload) as IBatalPesananResponse)
          : (cachedRow.response_payload as unknown as IBatalPesananResponse);
        return cachedPayload;
      }

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
        const failureResponse: IBatalPesananResponse = {
          success: false,
          message: `Kursi ${seat_number} tidak dapat dibatalkan karena berstatus ${seatRow.status}.`,
        };

        await conn.execute(
          'INSERT INTO idempotency_keys (key_id, request_hash, response_payload) VALUES (?, ?, ?)',
          [cancelKey, requestHash, JSON.stringify(failureResponse)]
        );

        return failureResponse;
      }

      await conn.execute(
        'UPDATE seats SET status = "AVAILABLE", updated_at = NOW() WHERE id = ?',
        [seatRow.id]
      );

      await conn.execute(
        'INSERT INTO transactions (transaction_id, seat_id, user_id, status) VALUES (?, ?, ?, ?)',
        [cancelKey, seatRow.id, user_id, 'CANCELLED']
      );

      const updatedSeat: ISeat = {
        id: seatRow.id,
        schedule_id: seatRow.schedule_id,
        seat_number: seatRow.seat_number,
        status: SeatStatus.AVAILABLE,
        updated_at: new Date().toISOString(),
      };

      const successResponse: IBatalPesananResponse = {
        success: true,
        message: `Pemesanan kursi ${seat_number} berhasil dibatalkan.`,
        seat: updatedSeat,
      };

      await conn.execute(
        'INSERT INTO idempotency_keys (key_id, request_hash, response_payload) VALUES (?, ?, ?)',
        [cancelKey, requestHash, JSON.stringify(successResponse)]
      );

      return successResponse;
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

/**
 * 6. RPC GetKatalogFilm: Mengambil seluruh film yang tersedia di bioskop
 */
export async function getKatalogFilmHandler(
  _call: grpc.ServerUnaryCall<IGetKatalogFilmRequest, IGetKatalogFilmResponse>,
  callback: grpc.sendUnaryData<IGetKatalogFilmResponse>
): Promise<void> {
  try {
    const [rows] = await pool.execute<IMovieDbRow[]>(
      'SELECT id, title, edition, genre, duration_minutes, poster_url, synopsis, rating, default_studio FROM movies ORDER BY id ASC'
    );

    const movies: IMovie[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      edition: r.edition,
      genre: r.genre,
      duration_minutes: r.duration_minutes,
      poster_url: r.poster_url || '',
      synopsis: r.synopsis || '',
      rating: r.rating,
      default_studio: r.default_studio,
    }));

    callback(null, { movies });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[TIXO-RPC] Error GetKatalogFilm:', errorMsg);
    callback({
      code: grpc.status.INTERNAL,
      message: `Gagal mengambil katalog film: ${errorMsg}`,
    });
  }
}

/**
 * 7. RPC GetDaftarJadwal: Mengambil daftar seluruh jadwal beserta kalkulasi harga weekend
 */
export async function getDaftarJadwalHandler(
  call: grpc.ServerUnaryCall<IGetDaftarJadwalRequest, IGetDaftarJadwalResponse>,
  callback: grpc.sendUnaryData<IGetDaftarJadwalResponse>
): Promise<void> {
  const movieId = call.request.movie_id;

  try {
    let query = 'SELECT id, movie_id, movie_name, studio_name, start_time, base_price FROM schedules';
    const params: string[] = [];

    if (movieId) {
      query += ' WHERE movie_id = ?';
      params.push(movieId);
    }
    query += ' ORDER BY start_time ASC';

    const [rows] = await pool.execute<IScheduleDbRow[]>(query, params);

    const schedules: IScheduleDetail[] = rows.map((s) => {
      const pricing = calculateSchedulePricing(s.start_time, s.base_price || 40000);
      return {
        id: s.id,
        movie_id: s.movie_id,
        movie_name: s.movie_name,
        studio_name: s.studio_name,
        start_time: pricing.startTimeIso,
        date_formatted: pricing.dateFormatted,
        time_formatted: pricing.timeFormatted,
        base_price: s.base_price || 40000,
        ticket_price: pricing.ticketPrice,
        is_weekend: pricing.isWeekend,
      };
    });

    callback(null, { schedules });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[TIXO-RPC] Error GetDaftarJadwal:', errorMsg);
    callback({
      code: grpc.status.INTERNAL,
      message: `Gagal mengambil daftar jadwal: ${errorMsg}`,
    });
  }
}

/**
 * 8. RPC SignInWithGoogle: Autentikasi dan pendaftaran user berbasis Google / Gmail
 */
export async function signInWithGoogleHandler(
  call: grpc.ServerUnaryCall<IGoogleSignInRequest, IGoogleSignInResponse>,
  callback: grpc.sendUnaryData<IGoogleSignInResponse>
): Promise<void> {
  const { email, name, avatar_url, id_token } = call.request;

  if (!email || !name) {
    callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: 'Parameter email dan name akun Google wajib diisi.',
    });
    return;
  }

  // Buat deterministic or random user ID
  const userId = `usr-${crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex').slice(0, 12)}`;
  const avatar = avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
  const sessionToken = uuidv4();

  try {
    await pool.execute(
      `INSERT INTO users (id, email, name, avatar_url, google_id)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), avatar_url = VALUES(avatar_url), updated_at = NOW()`,
      [userId, email.toLowerCase().trim(), name, avatar, id_token || null]
    );

    const userProfile: IUserProfile = {
      id: userId,
      email: email.toLowerCase().trim(),
      name,
      avatar_url: avatar,
    };

    console.log(`[TIXO-AUTH] Pengguna login via Gmail: ${email} (${name})`);

    callback(null, {
      success: true,
      message: 'Autentikasi akun Google berhasil.',
      user: userProfile,
      session_token: sessionToken,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[TIXO-AUTH] Error SignInWithGoogle:', errorMsg);
    callback({
      code: grpc.status.INTERNAL,
      message: `Gagal melakukan sign in dengan Google: ${errorMsg}`,
    });
  }
}
