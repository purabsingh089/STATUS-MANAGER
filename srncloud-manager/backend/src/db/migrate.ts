import { runMigrations, closeDatabase } from './database.js';
import { logger } from '../shared/logger.js';

async function main() {
  logger.setConsole(true);
  await runMigrations();
  logger.info('Migrations complete');
  closeDatabase();
  process.exit(0);
}

main().catch(err => {
  logger.error('Migration failed', { error: String(err) });
  process.exit(1);
});
