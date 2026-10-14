import pg from 'pg';

export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 3000,
    statement_timeout: 3000,
    query_timeout: 4000,
  });

  // Idle connections can fail independently of a request (e.g. PostgreSQL stops).
  pool.on('error', () => {
    console.error('An idle database connection failed.');
  });

  return pool;
}
