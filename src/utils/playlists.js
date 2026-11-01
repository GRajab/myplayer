import { reconcileCategoryPreferences } from './categories';
export function emptyLibrary() { return { playlists: [], defaultPlaylistId: null, activePlaylistId: null }; }
export function refreshEntry(entry, items, preserveMissing = false) {
  // Background refreshes may return a partial catalogue; retain saved sections.
  const missing = preserveMissing ? ['live', 'vod', 'series'].filter(category => !items.some(item => item.category === category) && entry.items?.some(item => item.category === category)) : [];
  if (missing.length) items = [...items, ...entry.items.filter(item => missing.includes(item.category))];
  return { ...entry, items, catalogueWarning: missing.length ? 'Provider returned an incomplete library · Using saved content.' : items.some(item => item.category === 'live') && !items.some(item => item.category === 'vod' || item.category === 'series') ? 'Only Live TV detected. No Movies or Series found in this playlist response.' : '', categoryPreferences: { ...entry.categoryPreferences, live: reconcileCategoryPreferences(entry.categoryPreferences?.live, [...new Set(items.filter(item => item.category === 'live').map(item => item.group))]) } };
}
export function migrateLibrary(saved) {
  let playlists = Array.isArray(saved?.playlists) ? saved.playlists.filter(entry => entry?.id && entry.config).map(entry => ({ ...entry, name: entry.name || 'Playlist', items: Array.isArray(entry.items) ? entry.items : [], favorites: entry.favorites || [], history: entry.history || [], categoryPreferences: entry.categoryPreferences || {}, hiddenChannels: entry.hiddenChannels || [] })) : [];
  if (!playlists.length && saved?.playlistConfig) playlists = [refreshEntry({ id: 'legacy', name: saved.playlistConfig.name || 'My playlist', config: saved.playlistConfig, favorites: saved.favorites || [], history: saved.history || [], categoryPreferences: saved.categoryPreferences || {}, hiddenChannels: [] }, saved.items || [])];
  const defaultPlaylistId = playlists.some(entry => entry.id === saved?.defaultPlaylistId) ? saved.defaultPlaylistId : playlists[0]?.id ?? null;
  return { playlists, defaultPlaylistId, activePlaylistId: defaultPlaylistId };
}
export function upsertPlaylist(state, entry, makeDefault = false) {
  const exists = state.playlists.some(item => item.id === entry.id);
  const playlists = exists ? state.playlists.map(item => item.id === entry.id ? entry : item) : [...state.playlists, entry];
  return { ...state, playlists, activePlaylistId: entry.id, defaultPlaylistId: playlists.length === 1 || makeDefault ? entry.id : state.defaultPlaylistId || playlists[0].id };
}
export function updatePlaylist(state, id, update) {
  return { ...state, playlists: state.playlists.map(entry => entry.id === id ? update(entry) : entry) };
}
