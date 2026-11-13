import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { vendorPlugin } from '../scripts/vendor-plugin.mjs';

test('бандл открывается из /front-map/: все vendor-импорты остаются внутри приложения', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'main.js')], bundle: true, format: 'esm',
    write: false, metafile: true, plugins: [vendorPlugin(root)], logLevel: 'silent'
  });
  const imports = Object.values(result.metafile.outputs).flatMap((output) => output.imports);
  assert.ok(imports.length >= 3, 'проверяются и main.js, и вложенные модули');
  for (const entry of imports) {
    assert.equal(entry.external, true);
    assert.equal(new URL(entry.path, 'https://example.test/front-map/main.js').pathname,
      '/front-map/vendor/' + path.basename(entry.path), entry.path);
  }
});
