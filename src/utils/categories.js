export const EMPTY_PREFERENCES = { order: [], hidden: [], showHidden: false };
export function normalizePreferences(value) {
  const strings = list => Array.isArray(list) ? [...new Set(list.filter(item => typeof item === 'string'))] : [];
  return { order: strings(value?.order), hidden: strings(value?.hidden), showHidden: value?.showHidden === true };
}
export function categoryOrder(names, saved = []) {
  return [...new Set([...saved.filter(name => names.includes(name)), ...names])];
}
// Move by identity so filtered/hidden rows never change the meaning of a drop.
export function moveCategory(order, moving, target, after = false) {
  if (moving === target || !order.includes(moving) || !order.includes(target)) return order;
  const next = order.filter(name => name !== moving);
  next.splice(next.indexOf(target) + (after ? 1 : 0), 0, moving);
  return next;
}
export function saveCategoryOrder(preferences, names, order) {
  return { ...preferences, order: [...order, ...preferences.order.filter(name => !names.includes(name))] };
}
export function reconcileCategoryPreferences(value, names) {
  const preferences = normalizePreferences(value);
  return { ...preferences, order: [...new Set([...preferences.order, ...names])] };
}
export function categoryDropTarget(rows, y, top, offset, rowHeight) {
  if (!rows.length) return null;
  const position = Math.max(0, y - top + offset);
  const index = Math.min(rows.length - 1, Math.floor(position / rowHeight));
  return { name: rows[index].name, after: position >= index * rowHeight + rowHeight / 2 };
}
export function dragScrollOffset(y, height, offset, count, rowHeight) {
  if (!height) return offset;
  const edge = Math.min(64, height / 3);
  const speed = y < edge ? -Math.min(20, (edge - y) / 3) : y > height - edge ? Math.min(20, (y - height + edge) / 3) : 0;
  return Math.max(0, Math.min(Math.max(0, count * rowHeight - height), offset + speed));
}
