import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'public/icon.svg');
function magick(args) {
  const result = spawnSync('magick', args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message ?? result.stderr);
  }
  return result.stdout.trim();
}
function generate(path) {
  const dimensions = magick(['identify', '-format', '%wx%h', path]);
  const splash = /splash/i.test(path);
  magick([
    source,
    '-resize',
    splash ? '140x140' : dimensions,
    '-background',
    splash ? '#f3f1ec' : '#13233a',
    '-gravity',
    'center',
    '-extent',
    dimensions,
    path,
  ]);
}
function visit(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) visit(target);
    else if (entry.name.endsWith('.png')) generate(target);
  }
}
visit(join(root, 'android/app/src/main/res'));
visit(join(root, 'ios/App/App/Assets.xcassets'));
console.log('Native icons and splash screens generated from public/icon.svg');
