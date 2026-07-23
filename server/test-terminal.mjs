import { io } from 'socket.io-client';

const TOKEN      = process.env.TOKEN;
const SESSION_ID = process.env.SESSION_ID;

console.log('Token:', TOKEN?.slice(0,20) + '...');
console.log('Session:', SESSION_ID);

const socket = io('http://localhost:3000', {
  auth: { token: TOKEN, sessionId: SESSION_ID, cols: 80, rows: 24 },
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('[+] Connected:', socket.id);
  socket.emit('terminal:input', 'whoami\n');
});

socket.on('terminal:output', (data) => {
  process.stdout.write(data);
});

socket.on('terminal:error', (err) => {
  console.error('[-] Terminal error:', err);
});

socket.on('connect_error', (err) => {
  console.error('[-] Connection failed:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('\n[+] Done');
  process.exit(0);
}, 5000);
