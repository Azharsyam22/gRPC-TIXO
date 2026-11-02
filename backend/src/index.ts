import { getProtoPath, loadTixoProtoDefinition } from './config/protoLoader';
export * from './types/tixo';
export * from './config/protoLoader';

export const APP_NAME = 'TIXO Backend Server';

// Quick sanity check for proto loader
try {
  const path = getProtoPath();
  const definition = loadTixoProtoDefinition();
  console.log(`[TIXO] Proto loaded successfully from: ${path}`);
  console.log(`[TIXO] Found ${Object.keys(definition).length} services/methods in package definition.`);
} catch (err) {
  console.error('[TIXO] Error loading proto definition:', err);
}
