import { getProtoPath, loadTixoProtoDefinition } from './config/protoLoader';
import { checkDatabaseConnection } from './config/database';

export * from './types/tixo';
export * from './config/protoLoader';
export * from './config/database';

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
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[TIXO] Error during bootstrap check:', errorMsg);
  }
}

// Hanya jalankan jika dieksekusi langsung
if (require.main === module) {
  void bootstrap();
}
