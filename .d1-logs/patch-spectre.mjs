import fs from 'fs';

const roots = [
  'node_modules/@vscode/spdlog/binding.gyp',
  'node_modules/node-pty/binding.gyp',
  'node_modules/@vscode/policy-watcher/binding.gyp',
  'node_modules/@vscode/windows-process-tree/binding.gyp',
  'node_modules/kerberos/binding.gyp',
  'node_modules/native-keymap/binding.gyp',
  'node_modules/@vscode/sqlite3/binding.gyp',
  'node_modules/@vscode/windows-mutex/binding.gyp',
  'node_modules/@vscode/native-watchdog/binding.gyp',
  'node_modules/native-is-elevated/binding.gyp',
  'node_modules/windows-foreground-love/binding.gyp',
  'node_modules/@vscode/windows-ca-certs/binding.gyp',
  'node_modules/@vscode/windows-registry/binding.gyp',
  'node_modules/@vscode/deviceid/binding.gyp',
];

let n = 0;
for (const rel of roots) {
  if (!fs.existsSync(rel)) continue;
  let s = fs.readFileSync(rel, 'utf8');
  const before = s;
  s = s.replace(/("SpectreMitigation"\s*:\s*)"Spectre"/g, '$1"false"');
  s = s.replace(/('SpectreMitigation'\s*:\s*)'Spectre'/g, "$1'false'");
  s = s.replace(/("\/ZH:SHA_256")\s*\n(\s*"\/Zi")/g, '$1,\n$2');
  s = s.replace(/,?\s*"\/ZH:SHA_256"/g, '');
  s = s.replace(/,?\s*'\/ZH:SHA_256'/g, '');
  if (s !== before) {
    fs.writeFileSync(rel, s);
    n++;
    console.log('patched', rel);
  }
}
console.log('patched_count', n);
