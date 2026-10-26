// Enumerate the same test files explicitly: Node20 on Windows does not expand
// the quoted ** patterns formerly passed to --test by package.json.
import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
function filesBelow(folder, accept) {
  return readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? filesBelow(path, accept) : accept(entry.name) ? [relative(root, path)] : [];
  });
}
function run(args) {
  const child = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (child.error) throw child.error;
  if (child.status !== 0) process.exit(child.status ?? 1);
}
run(['tools/gen-registry.mjs']);
run(['--test', ...filesBelow(join(root, 'tests'), name => name.endsWith('.test.mjs')).sort(),
  ...filesBelow(join(root, 'modules'), name => name === 'module.test.mjs').sort()]);
