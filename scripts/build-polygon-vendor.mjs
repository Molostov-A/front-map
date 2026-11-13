// Воспроизводимый автономный ESM для разработки без bundler и без CDN.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
await build({ entryPoints: [path.join(root, 'node_modules/polygon-clipping/dist/polygon-clipping.esm.js')],
  outfile: path.join(root, 'vendor/polygon-clipping.mjs'), bundle: true, format: 'esm',
  platform: 'browser', target: 'es2020', minify: true, legalComments: 'eof', banner: { js: '// @ts-nocheck — generated third-party bundle; see POLYGON-LICENSES.txt' } });
const licenses = ['polygon-clipping', 'splaytree', 'robust-predicates'].map((name) => {
  const dir = path.join(root, 'node_modules', name);
  const file = fs.readdirSync(dir).find((f) => /^licen[sc]e(?:\.|$)/i.test(f));
  const text = file ? fs.readFileSync(path.join(dir, file), 'utf8')
    : fs.readFileSync(path.join(dir, 'Readme.md'), 'utf8').split('## License')[1];
  if (!text) throw new Error('Missing license: ' + name);
  return name + '\n' + text;
});
fs.writeFileSync(path.join(root, 'vendor/POLYGON-LICENSES.txt'), licenses.join('\n\n'));
