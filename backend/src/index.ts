import { getProtoPath, loadTixoProtoDefinition } from './config/protoLoader';
import { checkDatabaseConnection } from './config/database';
import { streamManager } from './services/streamManager';

export * from './types/tixo';
export * from './config/protoLoader';
export * from './config/database';
export * from './services/streamManager';

export const APP_NAME = 'TIXO Backend Server';

async function bootstrap(): Promise<void> {
  try {
    const protoPath = getProtoPath();
    const definition = loadTixoProtoDefinition();
    console.log(`[TIXO] Proto loaded successfully from: ${protoPath}`);
    console.log(`[TIXO] Found ${Object.keys(definition).length} services/methods in package definition.`);

    const isDbConnected = await checkDatabaseConnection();
    if (isDbConnected) {
      console.log('[TIXO-DB] Terhubung ke database MySQL dengan sukses.');
    } else {
      console.log('[TIXO-DB] Server siap, menunggu ketersediaan database MySQL...');
    }

    console.log(`[TIXO-STREAM] StreamManager initialized. Total active streams: ${streamManager.getActiveClientCount()}`);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[TIXO] Error during bootstrap check:', errorMsg);
  }
}

// Hanya jalankan jika dieksekusi langsung
if (require.main === module) {
  void bootstrap();
}
