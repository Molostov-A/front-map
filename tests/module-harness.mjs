// Исполняет настоящий модуль с явно подставленными зависимостями без DOM/MapLibre.
import fs from 'node:fs';
import vm from 'node:vm';

export function loadModule(relative, bindings) {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
  const names = [...source.matchAll(/^export (?:async )?(?:function|const|let) (\w+)/gm)].map((m) => m[1]);
  const code = source.replace(/^import [^;]*;\r?\n/gm, '').replace(/^export /gm, '');
  return vm.runInNewContext(`${code}\n;({${names.join(',')}})`, bindings, { filename: relative });
}

export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
