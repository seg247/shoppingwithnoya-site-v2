import test from 'node:test';
import assert from 'node:assert/strict';
let api = {};
try { api = await import('../src/lib/structured-data.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }

test('feed text cannot close a structured-data script element', () => {
  assert.equal(typeof api.serializeStructuredData, 'function', 'Missing safe JSON-LD serializer');
  const data = { name: '</script><img src=x onerror=alert(1)> & "quoted"' };
  const output = api.serializeStructuredData(data);
  assert.ok(!output.includes('<'));
  assert.deepEqual(JSON.parse(output), data);
});
