// Текущий пользователь и права: canEdit() (viewer — только чтение), локальная видимость слоёв у viewer.

export let currentUser = null;

export function setCurrentUser(u) { currentUser = u; }

// viewer только смотрит: инструменты рисования и любые записи на сервер недоступны.
export const canEdit = () => !!currentUser && currentUser.role !== 'viewer';

export const viewerVisibility = new Map(); // layerId -> visible: локальные переключения видимости у viewer
