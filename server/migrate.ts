import { createDatabase } from './database.js';
import { migrate } from './schema.js';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const database = createDatabase(process.env.DATABASE_URL);
try { await migrate(database); console.log('Migrations complete.'); }
catch { console.error('Migration failed; transaction rolled back.'); process.exitCode = 1; }
finally { await database.end(); }
