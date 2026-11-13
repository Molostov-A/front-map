# frontend — клиент front-map

**Публичный** репозиторий: ничего секретного. Push в `main` = деплой на GitHub Pages (Actions: lint → typecheck →
test → build → deploy). MapLibre GL + ванильный JS, нативные ES-модули без сборки в разработке; прод собирается esbuild.

## Команды

```bash
npm test            # юнит-тесты (node:test)
npm run lint        # ESLint: no-undef, no-unused-vars
npm run typecheck   # tsc --noEmit по JSDoc-типам (src/types.d.ts)
npm run build       # dist/: бандл, config, styles с хешами в имени + vendor/
```

Локально фронтенд раздаёт бэкенд (`SERVE_STATIC=1`) или `start.bat` из корня монорепы; `config.js` на localhost
сам берёт API с того же origin. Полная проверка с e2e — `tools\check.cmd` в корне монорепы.

## Слои модулей

`main.js` — вход: авторизация, карта, `bind*()`, первая загрузка. Логика в `src/` по слоям, **импорт только вниз**
(проверяет `tools/check-layers.mjs` в корне):

**core → map → ui → edit → tools → (data.js, ui/style-bindings.js) → main.js**

Вызов вверх — через `src/core/hooks.js` (`select`, `beginMove`, `reload`, `unauthorized`; реализации ставит
`main.js`) или реестр `src/core/tools-registry.js` (инструменты регистрирует `tools/index.js`). Модуль начинается
с однострочного описания; держать ≤ ~300 строк.

| Модуль | Что внутри |
| --- | --- |
| `core/store.js` | `state` (тип `AppState`), `map`/`setMap`, `STYLE_KEY` (type → `<type>Style`), `activeSelected`, `selectedArrow` |
| `core/session.js` | `currentUser`, `canEdit()` (viewer — только чтение), `viewerVisibility` |
| `core/api.js`, `core/days.js`, `core/util.js` | HTTP + Bearer-токен (401 → `hooks.unauthorized`); `currentDay()`; `$`, `$$`, `toast`, `diag` |
| `map/style-layers.js` | `rebuildStyle()` — источник `fmS-<layerId>` и слои `fmL-*` каждого слоя карты; `fmLIds()` для hit-test |
| `map/render.js` | **`refreshSources()`** — главный перерисовщик; `featureGeometry`, `toGeoJSON`, `handlesFor`, `draftFC` |
| `map/overlays.js` | оверлеи `fmO-*` и их порядок, размер ручек, штриховка, `metersPerPixel` |
| `map/markers.js`, `map/area-labels.js`, `map/ruler-canvas.js`, `map/basemap.js` | текстовые DOM-маркеры; подписи площади; деления линейки на канве; базовые карты |
| `ui/panel-binder.js` | декларативные панели: `renderPanel`/`bindPanel` по `data-*` атрибутам разметки |
| `ui/style-panels.js`, `ui/style-bindings.js` | `updateStylePanels()` (+ длина/площадь, кнопки стрелки); `bindStylePanels()` |
| `ui/{layer-list,timeline,dates-panel,float-panels,modals,auth,hint}.js` | список слоёв; таймлайн/календарь; даты объекта; плавающие панели; модалки; вход/пользователи; подсказка |
| `edit/selection.js` | `select(id)`, `syncStyle(type)` — стиль панели → выбранный объект |
| `edit/sync.js` | PUT: дебаунс 300 мс по id+дню, последовательная очередь по id, `saveFeature` для текста/геометрии, `deleteSelected` |
| `edit/move-mode.js`, `edit/geometry.js` | режим «Переместить»; `applyCoord`/`translateGeom` |
| `tools/<type>.js` | инструмент целиком (см. ниже); `tools/select.js` — «Выбор» (onClick / onDblClick / onHover / hint) |
| `tools/index.js`, `tools/draw.js`, `tools/map-events.js` | реестр + `finishDraft`; `setTool`, `createFeature`, `commitDraft`; раздача событий карты и клавиатура |
| `data.js` | `reload()` — карта на выбранный день и перерисовка всего UI |
| `shared/feature-schema.mjs` | **общая схема свойств** (клиент + сервер): поля, значения по умолчанию, диапазоны |
| `arrow.mjs`, `measure.mjs`, `basemaps.mjs` | чистые функции: геометрия стрелки (метры Меркатора); длина/площадь (геодезия); список карт |
| `src/types.d.ts` | `Feature`, `Layer`, `Draft`, `Tool`, `AppState` — контракт для JSDoc и tsc |

**Интерфейс инструмента** (`tools/<type>.js`, тип `Tool`): `hint(draft)` → текст; `onClick({lngLat, point, shift})` →
`true`, если черновик пора завершить; `draft(draft)` → GeoJSON-объекты черновика; `finish(draft)` → геометрия или
`null`; `selectAfterCreate`. Без Shift линия/стрелка/линейка завершаются на втором клике, Shift — многоузловой режим.

## Разметка и панели

`index.html` — только разметка; стили `styles/{base,map,modals,auth,readonly}.css` (порядок `<link>` = каскад).
**id и классы DOM, `window.__map`, `document.title` (`ready` / `ERR: …`) — контракт e2e, не переименовывать.**

Панель стиля `#<type>-style` описывается атрибутами, кода на поле нет:
`data-field="label.color"` (путь в стиле), `data-scale="100"`, `data-enabled-if="stemMode=smooth"` / `"earsEnabled"` /
`"!smooth"`, `<span data-out="opacity" data-format="percent|px|pxRound|m|fixed1|fixed2">`, сегменты
`.as-seg[data-field] > button[data-value]` (`data-type="bool"` для true/false).

## Грабли

- **Shift подавляет `click` в MapLibre** (Shift+drag = boxZoom): `setTool` выключает boxZoom для рисования,
  Shift читается из `e.originalEvent.shiftKey`.
- **`line-dasharray` — data-constant**: на каждый тип штриха свой слой (`fmL-line-<id>-<dash>`, `fmL-outline-<id>-<dash>`).
- Слои `fmL-*` общие для всех типов, порядок важен (заливки под линиями); стрелка заливается слоем `fmL-fill-*`.
- `fmO-draft-fill`/`fmO-sel-fill` фильтруют `Polygon`, иначе черновик линии заливал бы площадь.
- **День всегда передаёт клиент** (`currentDay()`): сервер без `date` возьмёт UTC-день.
- Клиент шлёт в PUT полный набор свойств (сервер всё равно сливает частичные).
- Стрелка считается в метрах Меркатора (`arrow.mjs`), длина/площадь — геодезически (`measure.mjs`).
- Панели перекрывают карту — в e2e кликать с учётом этого.

## Тесты

`tests/*.test.mjs` на `node:test`: arrow, basemap, measure, feature-schema (golden: `fixtures/props-golden.json` —
выход прежних серверных нормализаторов, не перегенерировать), panel-binder (подделка DOM).
E2E — `../backend/scripts/e2e.js`. Новая логика → юнит-тест для чистой функции, UI → `check(...)` в e2e.

Сохранения текста, стиля и геометрии проходят через `edit/sync.js`: запросы одного объекта
последовательны; ответы проверяют поколение правки, день и ссылку на актуальный объект.
Тесты асинхронных сценариев используют `tests/module-harness.mjs` с подменой импортируемых
зависимостей (исполняется настоящий код модуля, без DOM/MapLibre).

После 401 `showLogin` очищает текущего пользователя и включает readonly. Первый
вход завершает `ensureAuth`, повторный вход перезагружает страницу с чистым
состоянием. Очередь PUT проверяет снимок токена до отправки и после ответа:
правки старой сессии не исполняются от имени нового пользователя.

Движение мыши (черновик, вершины, перенос объекта) вызывает
`map/render.js:scheduleRefreshSources(afterRefresh?)`: карта и измерения обновляются
один раз на кадр. `refreshSources()` остаётся немедленным и отменяет ожидающий кадр.
Планировщик `core/frame.js` тестируется с подставленными request/cancelAnimationFrame.

Внешние vendor-импорты сборки нормализует `scripts/vendor-plugin.mjs` к `./vendor/…`:
относительные пути вложенных исходников нельзя оставлять в итоговом бандле.
`tests/build-paths.test.mjs` проверяет импорты при размещении в `/front-map/`.
Ручная проверка сборки в браузере: Node 20 → `../tools/browser-preview.mjs`
(из корня: `node tools/browser-preview.mjs`); временная БД, свободный порт.

Полигональные операции: `polygon.mjs` + `shared/polygon-ops.mjs`; движок
polygon-clipping 0.15.7 собран в `vendor/polygon-clipping.mjs` командой
`npm run vendor:polygons` (лицензии рядом). Polygon и MultiPolygon — один тип
объекта polygon. Ручка хранит polygon/ring/index; редактирование первого узла
обновляет замыкающий. После shared-правок запускать sync-shared.
