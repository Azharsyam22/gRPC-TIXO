import { pool } from '../config/database';

async function reset(): Promise<void> {
  await pool.query('UPDATE seats SET status = "AVAILABLE"');
  await pool.query('DELETE FROM transactions');
  await pool.query('DELETE FROM idempotency_keys');
  console.log('[RESET] DB Reset to AVAILABLE complete.');
  await pool.end();
}

void reset();

