/** Validate the independently confirmed endpoint without logging any connection value. */
export function assertOperatorEndpoint(connection: string, expected: string | undefined) {
  const url = new URL(connection);
  const allowed = ['options','sslmode','sslrootcert','sslcert','sslkey','ssl','uselibpqcompat'];
  if (!expected || url.host !== expected || !['postgres:','postgresql:'].includes(url.protocol)
    || [...url.searchParams.keys()].some(key => !allowed.includes(key))) {
    throw new Error('Operator endpoint mismatch or unsupported connection override.');
  }
}
