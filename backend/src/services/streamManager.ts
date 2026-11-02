import * as grpc from '@grpc/grpc-js';
import { IPantauStatusRequest, IStatusKursiUpdate, SeatStatus } from '../types/tixo';

export type TixoStreamCall = grpc.ServerWritableStream<IPantauStatusRequest, IStatusKursiUpdate>;

export class StreamManager {
  // Map scheduleId -> Set of active client stream calls
  private scheduleClients: Map<string, Set<TixoStreamCall>> = new Map();

  /**
   * Menambahkan client stream baru ke daftar pendengar aktif berdasarkan schedule_id.
   * Dilengkapi event listener otomatis untuk mencegah memory leak.
   */
  public addClient(scheduleId: string, call: TixoStreamCall): void {
    if (!this.scheduleClients.has(scheduleId)) {
      this.scheduleClients.set(scheduleId, new Set<TixoStreamCall>());
    }

    const clientSet = this.scheduleClients.get(scheduleId);
    if (!clientSet) {
      return;
    }

    clientSet.add(call);
    console.log(
      `[TIXO-STREAM] Client terhubung ke schedule: ${scheduleId}. Total klien aktif di jadwal ini: ${clientSet.size}`
    );

    // Handler pembersihan saat koneksi ditutup / terputus
    const cleanup = (): void => {
      this.removeClient(scheduleId, call);
    };

    call.on('cancelled', cleanup);
    call.on('error', cleanup);
    call.on('close', cleanup);
    call.on('finish', cleanup);
  }

  /**
   * Menghapus client stream dari daftar pendengar aktif.
   */
  public removeClient(scheduleId: string, call: TixoStreamCall): void {
    const clientSet = this.scheduleClients.get(scheduleId);
    if (!clientSet) {
      return;
    }

    if (clientSet.has(call)) {
      clientSet.delete(call);
      console.log(
        `[TIXO-STREAM] Client terputus dari schedule: ${scheduleId}. Sisa klien aktif: ${clientSet.size}`
      );
    }

    if (clientSet.size === 0) {
      this.scheduleClients.delete(scheduleId);
    }
  }

  /**
   * Menyiarkan (broadcast) perubahan status kursi ke seluruh client yang sedang memantau schedule tersebut.
   * Mengembalikan jumlah client aktif yang berhasil menerima event.
   */
  public broadcastSeatUpdate(
    scheduleId: string,
    seatNumber: string,
    status: SeatStatus
  ): number {
    const clientSet = this.scheduleClients.get(scheduleId);
    if (!clientSet || clientSet.size === 0) {
      console.log(`[TIXO-STREAM] Tidak ada listener aktif untuk schedule: ${scheduleId}`);
      return 0;
    }

    const updatePayload: IStatusKursiUpdate = {
      schedule_id: scheduleId,
      seat_number: seatNumber,
      status,
      timestamp: Date.now(),
    };

    let deliveredCount = 0;
    const deadStreams: TixoStreamCall[] = [];

    for (const client of clientSet) {
      try {
        // Cek apakah writable stream masih terbuka
        if (!client.writableEnded && !client.destroyed) {
          client.write(updatePayload);
          deliveredCount++;
        } else {
          deadStreams.push(client);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[TIXO-STREAM] Gagal mengirim stream ke salah satu klien: ${errorMsg}`);
        deadStreams.push(client);
      }
    }

    // Bersihkan stream yang sudah mati
    for (const deadStream of deadStreams) {
      this.removeClient(scheduleId, deadStream);
    }

    console.log(
      `[TIXO-STREAM] Broadcast terkirim: Kursi ${seatNumber} -> status ${SeatStatus[status]} ke ${deliveredCount} klien aktif.`
    );

    return deliveredCount;
  }

  /**
   * Menghitung total seluruh klien yang sedang terhubung ke stream server.
   */
  public getActiveClientCount(scheduleId?: string): number {
    if (scheduleId) {
      return this.scheduleClients.get(scheduleId)?.size ?? 0;
    }

    let total = 0;
    for (const clients of this.scheduleClients.values()) {
      total += clients.size;
    }
    return total;
  }

  /**
   * Menutup seluruh stream aktif saat shutdown server.
   */
  public clearAll(): void {
    for (const [scheduleId, clients] of this.scheduleClients.entries()) {
      for (const client of clients) {
        try {
          client.end();
        } catch {
          // Abaikan jika sudah tertutup
        }
      }
      clients.clear();
      console.log(`[TIXO-STREAM] Seluruh stream pada schedule ${scheduleId} telah ditutup.`);
    }
    this.scheduleClients.clear();
  }
}

// Singleton StreamManager Instance
export const streamManager = new StreamManager();

