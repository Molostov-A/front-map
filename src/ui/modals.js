// Модалки: ввод имени/цвета (promptModal) и выбор варианта удаления (askDelete).
import { currentDay, fmtDay } from '../core/days.js';
import { state } from '../core/store.js';
import { $ } from '../core/util.js';

export let modalResolve = null;

export function promptModal({ title, name = '', color = '#e63946', showColor = true }) {
  return new Promise((resolve) => {
    modalResolve = resolve;
    $('#modal-title').textContent = title;
    $('#modal-name').value = name;
    $('#modal-color').value = color;
    $('#modal-color').style.display = showColor ? '' : 'none';
    $('#modal-color-label').style.display = showColor ? '' : 'none';
    $('#modal-back').style.display = 'flex';
    setTimeout(() => $('#modal-name').focus(), 0);
  });
}

export function closeModal(val) {
  $('#modal-back').style.display = 'none';
  if (modalResolve) { const r = modalResolve; modalResolve = null; r(val); }
}

export const modalOpen = () => $('#modal-back').style.display === 'flex';

export let deleteResolve = null;

export function askDelete() {
  return new Promise((resolve) => {
    deleteResolve = resolve;
    $('#delete-date').textContent = fmtDay(currentDay());
    // «С даты» возможно только после дня создания, иначе объект пропал бы во всех днях.
    const f = state.features.find((x) => x.id === state.selectedId);
    const fromBtn = $('#delete-from');
    fromBtn.disabled = !!f && currentDay() <= f.created_at;
    fromBtn.title = fromBtn.disabled ? 'Объект создан в этот день — удалите во всех периодах' : '';
    $('#delete-back').style.display = 'flex';
  });
}

export function closeDelete(v) {
  $('#delete-back').style.display = 'none';
  const r = deleteResolve; deleteResolve = null;
  if (r) r(v);
}

export const deleteOpen = () => $('#delete-back').style.display === 'flex';

// Модалки: имя/цвет слоя (prompt) и выбор варианта удаления.
export function bindModals() {
  $('#modal-ok').onclick = () => closeModal({ name: $('#modal-name').value, color: $('#modal-color').value });
  $('#modal-cancel').onclick = () => closeModal(null);
  $('#modal-back').onclick = (e) => { if (e.target.id === 'modal-back') closeModal(null); };

  $('#delete-all').onclick = () => closeDelete('all');
  $('#delete-from').onclick = () => closeDelete('from');
  $('#delete-cancel').onclick = () => closeDelete(null);
  $('#delete-back').onclick = (e) => { if (e.target.id === 'delete-back') closeDelete(null); };
}
