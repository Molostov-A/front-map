// Мелкие DOM-хелперы, тост, диагностика ошибок в <title> (используется e2e).

export const $ = (s) => document.querySelector(s);

export const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

/* даты (гранулярность — день, формат YYYY-MM-DD) */

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2400);
}

// диагностика: ошибки видны в <title> (для headless-проверок) и в консоли
export function diag(msg) {
  document.title = 'ERR: ' + msg;
  console.error('[front-map] ' + msg);
}
