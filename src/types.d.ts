// Типы данных клиента для проверки типов (tsc, checkJs) и как документация контрактов.
// В JS подключаются через JSDoc: /** @type {import('./types').Feature} */ (путь — относительно файла).

/** Координата [lng, lat]. */
export type LngLat = [number, number];

/** Слой карты (как отдаёт GET /api/map). */
export interface Layer {
  id: number;
  name: string;
  z_order: number;
  visible: boolean;
  color: string;
  created_at: string;
}

export type FeatureType = 'line' | 'polygon' | 'point' | 'label' | 'arrow' | 'ruler';

/** Объект карты на выбранный день (GET /api/map, ответы POST/PUT /api/features). */
export interface Feature {
  id: number;
  layer_id: number;
  type: FeatureType;
  /** Свойства по общей схеме shared/feature-schema.mjs (+ nodeMeta у линии/стрелки). */
  properties: Record<string, any>;
  /** GeoJSON-геометрия; у стрелки — центральная линия (LineString). */
  geometry: { type: string; coordinates: any } | null;
  /** День создания YYYY-MM-DD. */
  created_at: string;
  /** Последний день, когда объект виден (YYYY-MM-DD), или null. */
  deleted_at: string | null;
}

/** Черновик рисования: у стрелки — nodes, у остальных — coords; cursor — точка под курсором. */
export interface Draft {
  type: FeatureType;
  coords?: LngLat[];
  nodes?: LngLat[];
  cursor: LngLat | null;
}

/** Перетаскивание вершины или касательной выбранного объекта. */
export type Drag =
  | { featureId: number; index: number; ring: number; moved: boolean; type?: undefined }
  | { featureId: number; type: 'tangent'; index: number; which: 'in' | 'out'; moved: boolean };

/** Контекст клика для инструмента рисования. */
export interface ToolClick {
  lngLat: LngLat;
  point: { x: number; y: number };
  shift: boolean;
}

/** Инструмент (src/tools/<type>.js). */
export interface Tool {
  /** Текст подсказки для текущего черновика. */
  hint?: (draft: Draft | null) => string;
  /** Клик по карте; true — черновик пора завершить. «Выбор» получает событие MapLibre. */
  onClick?: (ctx: ToolClick | any) => boolean | void;
  onDblClick?: (e: any) => void;
  onHover?: (e: any) => void;
  /** GeoJSON-объекты черновика для оверлея fmO-draft. */
  draft?: (draft: Draft) => any[];
  /** Черновик → геометрия нового объекта или null. */
  finish?: (draft: Draft) => { type: string; coordinates: any } | null;
  /** Выбрать объект сразу после создания. */
  selectAfterCreate?: boolean;
}

/** Даты выбранного объекта (GET /api/features/:id/dates). */
export interface FeatureDates {
  id: number;
  created_at: string;
  deleted_at: string | null;
  changes: { id: number; valid_from: string; created_at: string }[];
}

/** Единое состояние клиента (src/core/store.js). */
export interface AppState {
  layers: Layer[];
  features: Feature[];
  activeLayerId: number | null;
  tool: string;
  selectedId: number | null;
  draft: Draft | null;
  drag: Drag | null;
  /** Режим «Дорисовать» для выбранной стрелки. */
  appendArrow: boolean;
  arrowStyle: Record<string, any>;
  lineStyle: Record<string, any>;
  polygonStyle: Record<string, any>;
  pointStyle: Record<string, any>;
  labelStyle: Record<string, any>;
  rulerStyle: Record<string, any>;
  /** id → { marker, el } — DOM-маркеры надписей и подписей точек. */
  markers: Map<number, any>;
  /** id → маркер подписи площади полигона. */
  areaMarkers: Map<number, any>;
  moveMode: boolean;
  /** Активное перемещение: { featureId, start, orig, moved }. */
  move: { featureId: number; start: LngLat; orig: any; moved: boolean } | null;
  ignoreNextClick: boolean;
  /** Выбранный день YYYY-MM-DD; null — «сейчас». */
  date: string | null;
  dates: FeatureDates | null;
  /** Отображаемый месяц календаря (1-е число). */
  calView: Date | null;
}

declare global {
  interface Window {
    /** Адрес API (config.js; '' — тот же origin). */
    __FM_API_BASE?: string;
    /** Экземпляр карты — для e2e. */
    __map?: any;
  }
}
