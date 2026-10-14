import { createServer } from 'node:http';
import { createTicketBoardApp } from './app.js';

const server = createServer(createTicketBoardApp());
server.listen(4393, '127.0.0.1', () => {
  console.log('Ticket board: http://127.0.0.1:4393 — reads .scratch tickets on every request');
});
server.on('error', () => {
  console.error('The ticket board could not start. Check whether port 4393 is already in use.');
  process.exitCode = 1;
});
let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();
  server.close(() => clearTimeout(deadline));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
