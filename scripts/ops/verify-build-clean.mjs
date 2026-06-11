import { spawnSync } from 'node:child_process';

const result = spawnSync('npm', ['run', 'build'], {
  cwd: process.cwd(),
  encoding: 'utf8'
});

const output = `${result.stdout || ''}\n${result.stderr || ''}`;

if (result.status !== 0) {
  console.error(output);
  process.exit(result.status || 1);
}

if (output.includes('[INEFFECTIVE_DYNAMIC_IMPORT]')) {
  console.error('Build emitted ineffective dynamic import warning');
  process.exit(1);
}

console.log('build clean check passed');
