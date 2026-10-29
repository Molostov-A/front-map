// Декларативные панели стиля: разметка описывает связь контролов с полями стиля, код — общий.
//   data-field="path"        — контрол ↔ поле стиля (path через точку: "label.color");
//   data-scale="100"         — в контроле значение × scale (округлено), в стиле — ввод / scale;
//   data-enabled-if="cond"   — контрол активен при условии: "field", "!field", "field=value";
//   data-out="path" [data-format] — текст значения: raw | percent | px | pxRound | m | fixed1 | fixed2;
//   .as-seg[data-field] > button[data-value] — сегменты (data-type="bool": "1"/"0" ↔ true/false).
// Тип значения берётся из контрола: checkbox → boolean, range/number → число, остальное → строка.

const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] || (o[k] = {});
  o[keys[keys.length - 1]] = value;
}

const FORMATS = {
  raw: (v) => String(v),
  percent: (v) => Math.round(v * 100) + '%',
  px: (v) => v + ' px',
  pxRound: (v) => Math.round(v) + ' px',
  m: (v) => `${v} м`,
  fixed1: (v) => v.toFixed(1),
  fixed2: (v) => v.toFixed(2)
};

function isEnabled(style, cond) {
  const m = /^(!?)([\w.]+)(?:=(.+))?$/.exec(cond);
  if (!m) return true;
  const v = getPath(style, m[2]);
  const ok = m[3] !== undefined ? String(v) === m[3] : !!v;
  return m[1] ? !ok : ok;
}

const isSegment = (el) => el.classList.contains('as-seg');
const segValue = (v) => (typeof v === 'boolean' ? (v ? '1' : '0') : String(v));

/** Отобразить стиль в контролах панели `root`. */
export function renderPanel(root, style) {
  root.querySelectorAll('[data-field]').forEach((el) => {
    const v = getPath(style, el.dataset.field);
    if (isSegment(el)) {
      el.querySelectorAll('button[data-value]').forEach((b) => b.classList.toggle('active', b.dataset.value === segValue(v)));
    } else if (el.type === 'checkbox') {
      el.checked = !!v;
    } else {
      el.value = el.dataset.scale ? Math.round(v * Number(el.dataset.scale)) : v;
    }
  });
  root.querySelectorAll('[data-out]').forEach((el) => {
    el.textContent = (FORMATS[el.dataset.format] || FORMATS.raw)(getPath(style, el.dataset.out));
  });
  root.querySelectorAll('[data-enabled-if]').forEach((el) => {
    el.disabled = !isEnabled(style, el.dataset.enabledIf);
  });
}

/**
 * Привязать ввод в контролах панели `root` к стилю: getStyle() — объект стиля, который меняем,
 * onChange() — применить (нормализация, PUT, перерисовка).
 */
export function bindPanel(root, getStyle, onChange) {
  root.querySelectorAll('[data-field]').forEach((el) => {
    const field = el.dataset.field;
    if (isSegment(el)) {
      el.querySelectorAll('button[data-value]').forEach((b) => {
        b.addEventListener('click', () => {
          setPath(getStyle(), field, el.dataset.type === 'bool' ? b.dataset.value === '1' : b.dataset.value);
          onChange();
        });
      });
      return;
    }
    el.addEventListener('input', () => {
      let v;
      if (el.type === 'checkbox') v = el.checked;
      else if (el.type === 'range' || el.type === 'number') v = Number(el.value) / (el.dataset.scale ? Number(el.dataset.scale) : 1);
      else v = el.value;
      setPath(getStyle(), field, v);
      onChange();
    });
  });
}
