// Реестр инструментов: tools/index.js регистрирует их при старте (импорт из main.js), а нижние слои
// (map/render — черновик, ui/hint — подсказка) читают отсюда, не импортируя tools/ (импорт только вниз).
// Интерфейс инструмента — см. tools/index.js.
/** @type {Record<string, import('../types').Tool>} */
export const TOOLS = {};

export const registerTools = (tools) => Object.assign(TOOLS, tools);
