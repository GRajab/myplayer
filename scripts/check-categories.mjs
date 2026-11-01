import fs from 'node:fs';
import assert from 'node:assert/strict';
const source = fs.readFileSync('src/utils/categories.js', 'utf8');
const { categoryOrder, moveCategory, normalizePreferences, saveCategoryOrder } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const channels = Object.freeze([
  Object.freeze({ id: 'one', group: 'Sports' }),
  Object.freeze({ id: 'two', group: 'News' }),
  Object.freeze({ id: 'three', group: 'Cinema' }),
]);
const names = channels.map(channel => channel.group);
const original = JSON.stringify(channels);
let preferences = normalizePreferences({ order: ['News', 'Sports', 'News', 'Offline'], hidden: ['Sports'], showHidden: false });
assert.deepEqual(categoryOrder(names, preferences.order), ['News', 'Sports', 'Cinema']);
const order = categoryOrder(names, preferences.order);
assert.deepEqual(moveCategory(order, 'Cinema', 'News'), ['Cinema', 'News', 'Sports']);
assert.deepEqual(moveCategory(order, 'News', 'Cinema', true), ['Sports', 'Cinema', 'News']);
assert.deepEqual(moveCategory(order, 'News', undefined), order);
// A drop onto a searched row uses identities, preserving intervening hidden rows.
assert.deepEqual(moveCategory(['News', 'Hidden', 'Sports', 'Cinema'], 'Cinema', 'News'), ['Cinema', 'News', 'Hidden', 'Sports']);
preferences = saveCategoryOrder(preferences, names, moveCategory(order, 'Cinema', 'News'));
preferences = normalizePreferences(JSON.parse(JSON.stringify(preferences)));
assert.deepEqual(preferences.hidden, ['Sports']);
assert.deepEqual(preferences.order, ['Cinema', 'News', 'Sports', 'Offline']);
assert.deepEqual(categoryOrder([...names, 'Kids'], preferences.order), ['Cinema', 'News', 'Sports', 'Kids']);
assert.deepEqual(categoryOrder(['Sports', 'Kids'], preferences.order), ['Sports', 'Kids']);
assert.deepEqual(categoryOrder(names, []), names);
assert.deepEqual(normalizePreferences({ order: ['Sports', 7], hidden: null }), { order: ['Sports'], hidden: [], showHidden: false });
assert.equal(JSON.stringify(channels), original);
console.log('Category ordering, filtered drops, reset, persistence round-trip, new categories and channel immutability checks passed.');
const { reconcileCategoryPreferences, categoryDropTarget, dragScrollOffset } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const updated = reconcileCategoryPreferences(preferences, [...names, 'Kids']);
assert.deepEqual(updated.order, ['Cinema', 'News', 'Sports', 'Offline', 'Kids']);
assert.deepEqual(reconcileCategoryPreferences(updated, ['Kids', 'News', 'Nature']).order, ['Cinema', 'News', 'Sports', 'Offline', 'Kids', 'Nature']);
const rows = [{ name: 'News' }, { name: 'Sports' }, { name: 'Cinema' }];
assert.deepEqual(categoryDropTarget(rows, 120, 100, 0, 116), { name: 'News', after: false });
assert.deepEqual(categoryDropTarget(rows, 180, 100, 0, 116), { name: 'News', after: true });
assert.deepEqual(categoryDropTarget(rows, 120, 100, 116, 116), { name: 'Sports', after: false });
assert.deepEqual(categoryDropTarget(rows, 900, 100, 0, 116), { name: 'Cinema', after: true });
assert.equal(categoryDropTarget([], 20, 0, 0, 116), null);
assert.equal(dragScrollOffset(150, 300, 40, 10, 116), 40);
assert.ok(dragScrollOffset(295, 300, 40, 10, 116) > 40);
assert.ok(dragScrollOffset(5, 300, 40, 10, 116) < 40);
assert.equal(dragScrollOffset(0, 300, 0, 10, 116), 0);
assert.equal(dragScrollOffset(300, 300, 860, 10, 116), 860);
assert.equal(dragScrollOffset(300, 300, 0, 1, 116), 0);
console.log('Provider refresh reconciliation, drop coordinates and edge-scroll bounds checks passed.');
