// One command: backend API + Expo web. Ctrl+C stops both.
const { spawn } = require('node:child_process');

const target = process.argv[2] === 'android' ? 'android' : process.argv[2] === 'ios' ? 'ios' : 'web';
const run = (name, args) => spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { stdio: 'inherit', shell: process.platform === 'win32' })
  .on('exit', (code) => { console.log(`[${name}] berhenti (kode ${code}).`); stop(); });
const children = [run('api', ['run', 'api']), run('app', ['run', target])];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    else child.kill();
  }
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
