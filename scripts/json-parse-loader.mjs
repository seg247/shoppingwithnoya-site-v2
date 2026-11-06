import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

// Only these explicitly supplied files bypass Vite's native JSON parser.
// A JS virtual identity is necessary: transforming .json in enforce:pre still
// leaves it eligible for the later builtin:vite-json transform.
export function jsonParseLoader(files) {
  const allowed = new Set(files.map(file => resolve(file)));
  const prefix = '\0swn-json-parse:';
  return {
    name: 'swn-json-parse',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (source.includes('?') || source.includes('#')) return null;
      if (source.startsWith('/@fs/')) source = source.slice(4);
      const file = source.startsWith('/') ? resolve(source)
        : source.startsWith('.') && importer && !importer.startsWith('\0')
          ? resolve(dirname(importer), source) : null;
      return file && allowed.has(file) ? prefix + file + '.mjs' : null;
    },
    // Virtual ids are not indexed under the physical JSON path. Associate
    // changes with the module in each Vite environment, including SSR.
    hotUpdate({ file, modules }) {
      if (!allowed.has(file)) return;
      const module = this.environment.moduleGraph.getModuleById(prefix + file + '.mjs');
      return module ? [...new Set([...modules, module])] : modules;
    },
    async load(id) {
      if (!id.startsWith(prefix) || !id.endsWith('.mjs')) return null;
      const file = id.slice(prefix.length, -4);
      if (!allowed.has(file)) return null;
      this.addWatchFile(file);
      const raw = await readFile(file, 'utf8');
      // Validation and export discovery use Node JSON.parse, never object
      // literal generation, eval, or a reviver. Preserve -0, overflow, duplicate
      // key semantics, own __proto__ keys and every UTF-16 code unit.
      const value = JSON.parse(raw);
      const literal = JSON.stringify(raw).replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
      const lines = [`const data = JSON.parse(${literal});`, 'export default data;'];
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        for (const [index, key] of Object.keys(value).entries()) {
          // Site imports are all default imports. Also retain identifier-shaped
          // top-level named exports, without user-controlled JS identifiers.
          if (/^[A-Za-z_$][\w$]*$/.test(key) && key !== 'default') {
            lines.push(`const value${index} = data[${JSON.stringify(key)}];`,
              `export { value${index} as ${key} };`);
          }
        }
      }
      return { code: lines.join('\n'), map: { mappings: '' } };
    },
  };
}
