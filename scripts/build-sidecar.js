import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const binariesDir = path.join(root, 'src-tauri', 'binaries');
const baseName = 'schoolsoft-backend';
const extension = process.platform === 'win32' ? '.exe' : '';
const plainOutput = path.join(binariesDir, `${baseName}${extension}`);
const targetTriple = execFileSync('rustc', ['--print', 'host-tuple'], { encoding: 'utf8' }).trim();
const tauriOutput = path.join(binariesDir, `${baseName}-${targetTriple}${extension}`);

fs.mkdirSync(binariesDir, { recursive: true });

const target = process.platform === 'win32'
  ? 'node22-win-x64'
  : 'host';

console.log(`Building desktop sidecar for ${targetTriple} using pkg target ${target}...`);

execFileSync('npx', [
  'pkg',
  'scripts/desktop-sidecar-router.cjs',
  '--targets', target,
  '--sea',
  '--no-bytecode',
  '--public-packages', '*',
  '--public',
  '--output', plainOutput
], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

if (fs.existsSync(tauriOutput)) fs.rmSync(tauriOutput, { force: true });
fs.renameSync(plainOutput, tauriOutput);
console.log(`Wrote Tauri sidecar: ${tauriOutput}`);
