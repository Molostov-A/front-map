// Конфигурация фронтенда: адрес API бэкенда (window.__FM_API_BASE).
// Если переменная уже задана (e2e-тестом, tools/serve-frontend.js), не перезаписываем.
// Локально (localhost / 127.0.0.1 / *.localhost / file://) — пустая строка, то есть тот же origin:
// бэкенд с SERVE_STATIC=1 сам раздаёт фронтенд, и запросы никогда не уходят в прод.
// На любом другом хосте (GitHub Pages) — прод-API.
(function () {
  if (window.__FM_API_BASE !== undefined) return;
  const PROD_API = 'https://front-map-api.duckdns.org';
  const h = location.hostname;
  const local = h === '' || h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost');
  window.__FM_API_BASE = local ? '' : PROD_API;
})();
