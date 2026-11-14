// Хуки для вызовов «снизу вверх» по слоям модулей (core → map → ui → edit → tools → main):
// нижний слой вызывает hooks.X(), main.js подставляет реализацию из верхнего слоя.
// Так нет циклических импортов. Новый хук — поле здесь + присваивание в main.js.
export const hooks = {
  /** select(id) — выбрать объект (edit/selection), вызывается из DOM-маркеров. */
  /** @type {(id: number | null, additive?: boolean) => void} */
  select: (id, additive) => {},
  /** @type {(id: number, shift?: boolean) => void} */
  featureClick: (id, shift) => {},
  /** beginMove(lngLat) — начать перемещение (edit/move-mode), из DOM-маркеров. */
  /** @type {(lngLat: number[]) => void} */
  beginMove: (lngLat) => {},
  /** reload() — перезагрузить карту на текущий день (data.js), из UI и sync. */
  reload: async () => {},
  /** @type {(context: any) => Promise<any>} */
  polygonOperation: async (context) => null,
  /** @type {(enabled: boolean) => void} */
  importMode: (enabled) => {},
  /** Ожидание сохранений перед чтением снимков и сброс временных оверлеев при правке. */
  flushSaves: async () => {},
  mapChanged: () => {},
  /** unauthorized() — показать форму входа (ui/auth), из api при 401. */
  unauthorized: () => {}
};
