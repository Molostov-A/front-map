// Конфигурация фронтенда.
// Для локальной разработки оставьте пустую строку (тот же origin).
// При деплое на GitHub Pages укажите базовый URL бэкенда, например:
//   window.__FM_API_BASE = 'https://map.example.com';
// Адрес API бэкенда. Если переменная уже задана (напр. e2e-тестом), не перезаписываем.
if (window.__FM_API_BASE === undefined) {
  window.__FM_API_BASE = 'https://front-map-api.duckdns.org';
}
