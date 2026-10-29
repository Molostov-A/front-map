// Сборка для GitHub Pages: dist/ = index.html + бандл модулей с хешем в имени + config с хешем + vendor/.
// Запуск: npm run build (нужен devDependency esbuild). В разработке сборка не нужна — работают нативные модули.
//
// - точка входа — <script type="module" src="./X.js"> из index.html;
// - vendor/ (MapLibre и его воркер) в бандл не входит: импорт './vendor/…' остаётся внешним и
//   резолвится от dist/, куда vendor копируется как есть;
// - ссылки на config.js и модуль в index.html переписываются на файлы с хешем — браузер никогда
//   не смешает старую и новую версии после деплоя.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const rel = (...p) => path.join(ROOT, ...p);
const shortHash = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

let html = fs.readFileSync(rel('index.html'), 'utf8');
const MODULE_RE = /<script\s+src="\.\/([\w-]+\.js)(?:\?v=\d+)?"\s+type="module"><\/script>/;
const CONFIG_RE = /<script\s+src="\.\/config\.js(?:\?v=\d+)?"><\/script>/;
const entryMatch = MODULE_RE.exec(html);
if (!entryMatch) throw new Error('index.html: не найден <script type="module" src="./X.js">');
if (!CONFIG_RE.test(html)) throw new Error('index.html: не найден <script src="./config.js">');
const entry = entryMatch[1];

const result = await esbuild.build({
  entryPoints: [rel(entry)],
  bundle: true,
  format: 'esm',
  target: 'es2020',
  minify: true,
  sourcemap: true,
  legalComments: 'none',
  external: ['./vendor/*'],
  outdir: DIST,
  entryNames: '[name].[hash]',
  metafile: true,
  logLevel: 'warning'
});
const bundle = Object.entries(result.metafile.outputs)
  .find(([, o]) => o.entryPoint)[0];
const bundleName = path.basename(bundle);

const config = fs.readFileSync(rel('config.js'));
const configName = `config.${shortHash(config)}.js`;
fs.writeFileSync(path.join(DIST, configName), config);

html = html
  .replace(MODULE_RE, `<script src="./${bundleName}" type="module"></script>`)
  .replace(CONFIG_RE, `<script src="./${configName}"></script>`);
fs.writeFileSync(path.join(DIST, 'index.html'), html);

for (const dir of ['vendor', 'examples']) {
  if (fs.existsSync(rel(dir))) fs.cpSync(rel(dir), path.join(DIST, dir), { recursive: true });
}
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

const kb = (f) => Math.round(fs.statSync(path.join(DIST, f)).size / 1024);
console.log(`dist/: ${bundleName} (${kb(bundleName)} KB, entry ${entry}), ${configName}, index.html, vendor/, examples/`);
