import { addedTimestamp, FIVE_DAYS_MS } from './movies';
export const SERIES_RECENT = 'system:series-recent';
export function seriesUpdatedAt(item) {
  const added = addedTimestamp(item.addedAt ?? item.added);
  const updated = addedTimestamp(item.updatedAt ?? item.last_modified);
  return added === null ? updated : updated === null ? added : Math.max(added, updated);
}
export function recentSeries(items, query = '', now = Date.now()) {
  const search = query.trim().toLowerCase();
  return items.filter(item => {
    const date = seriesUpdatedAt(item);
    return item.category === 'series' && date !== null && date <= now && date >= now - FIVE_DAYS_MS && (item.name || '').toLowerCase().includes(search);
  }).sort((a, b) => seriesUpdatedAt(b) - seriesUpdatedAt(a));
}
