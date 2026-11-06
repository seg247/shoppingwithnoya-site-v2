import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)));
const atLeast = (version, floor) => {
  const a = version.split('.').map(Number), b = floor.split('.').map(Number);
  for (let i=0;i<3;i++) { if(a[i]!==b[i]) return a[i]>b[i]; }
  return true;
};
for (const [name, floor] of [['astro','7.3.3'],['sharp','0.35.5'],['esbuild','0.28.1']]) {
  test(`${name}: every resolved copy is outside reviewed advisory ranges`, () => {
    const copies=Object.entries(lock.packages).filter(([p])=>p.endsWith(`node_modules/${name}`));
    if(name!=='esbuild') assert.ok(copies.length, `${name} must be resolved`);
    for (const [path, entry] of copies) assert.ok(atLeast(entry.version,floor), `${path}: ${entry.version} must be >= ${floor}`);
  });
}
test('Astro 7 migration explicitly preserves Astro 6 HTML whitespace compression', () => {
  const config=readFileSync(new URL('../astro.config.mjs',import.meta.url),'utf8');
  assert.match(config,/compressHTML:\s*true\b/);
});
