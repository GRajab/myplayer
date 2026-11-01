export const MOVIE_ALL = 'movies:all';
export const MOVIE_FAVORITES = 'movies:favorites';
export const MOVIE_NEW = 'movies:new';
export const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
export const movieGroupKey = name => `movies:group:${name}`;
export function addedTimestamp(value) {
  if (value == null || value === '') return null;
  let timestamp;
  if (typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value).trim())) {
    const number = Number(value);
    timestamp = number < 1e12 ? number * 1000 : number;
  } else {
    const text = String(value).trim();
    if (!/^\d{4}-\d{2}-\d{2}(?:$|T.*(?:Z|[+-]\d{2}:?\d{2})$)/i.test(text)) return null;
    timestamp = Date.parse(text);
  }
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}
export function recentlyAddedMovies(movies, now = Date.now()) {
  return movies.filter(movie => {
    const added = addedTimestamp(movie.addedAt ?? movie.added);
    return movie.category === 'vod' && added !== null && added >= now - FIVE_DAYS_MS && added <= now;
  }).sort((a, b) => addedTimestamp(b.addedAt ?? b.added) - addedTimestamp(a.addedAt ?? a.added));
}
export function movieBrowseResults(movies, favorites, query = '', category = MOVIE_ALL, now = Date.now()) {
  const library = movies.filter(movie => movie.category === 'vod');
  const searched = library.filter(movie => (movie.name || '').toLowerCase().includes(query.trim().toLowerCase()));
  const favoriteSet = new Set(favorites);
  const recent = recentlyAddedMovies(searched, now);
  const favoriteMovies = searched.filter(movie => favoriteSet.has(movie.id));
  const groups = [...new Set(library.map(movie => movie.group || 'Other'))].map(name => ({ id: movieGroupKey(name), name: /^(newly\s*added|favorites|all)$/i.test(name) ? name + ' · Provider' : name, count: searched.filter(movie => (movie.group || 'Other') === name).length }));
  const categories = [
    { id: MOVIE_NEW, name: 'Newly Added', count: recent.length },
    { id: MOVIE_FAVORITES, name: 'Favorites', count: favoriteMovies.length },
    { id: MOVIE_ALL, name: 'All', count: searched.length },
    ...groups,
  ];
  const selected = categories.some(item => item.id === category) ? category : MOVIE_ALL;
  const results = selected === MOVIE_NEW ? recent : selected === MOVIE_FAVORITES ? favoriteMovies : selected === MOVIE_ALL ? searched : searched.filter(movie => movieGroupKey(movie.group || 'Other') === selected);
  return { categories, results, selected };
}
function text(value) {
  if (Array.isArray(value)) return value.map(item => typeof item === 'string' ? item : item?.name).filter(Boolean).join(', ') || null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const result = String(value).trim();
  return !result || /^(null|undefined|n\/a|unknown|not available)$/i.test(result) ? null : result;
}
function poster(value) {
  try { const parsed = new URL(value); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null; } catch { return null; }
}
export function normalizeMovieMetadata(info = {}) {
  const suppliedSeconds = info.durationSeconds ?? info.duration_secs ?? info.duration_seconds;
  let durationSeconds = suppliedSeconds == null ? null : Number(suppliedSeconds);
  if (!(durationSeconds > 0) && typeof info.duration === 'string' && /^\d+:\d{2}(?::\d{2})?$/.test(info.duration)) durationSeconds = info.duration.split(':').reduce((seconds, part) => seconds * 60 + Number(part), 0);
  const suppliedRating = info.rating ?? (info.rating_5based ? Number(info.rating_5based) * 2 : null);
  const rating = suppliedRating == null || suppliedRating === '' ? null : Number(suppliedRating);
  return {
    title: text(info.title) || text(info.name),
    releaseDate: /^0{4}(?:-0{2}){0,2}$/.test(String(info.releaseDate ?? info.releasedate ?? info.release_date ?? info['release-date'])) ? null : text(info.releaseDate ?? info.releasedate ?? info.release_date ?? info['release-date']),
    durationSeconds: Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : null,
    rating: Number.isFinite(rating) && rating > 0 && rating <= 10 ? rating : null,
    genre: text(info.genre),
    summary: text(info.summary) || text(info.plot) || text(info.description),
    cast: text(info.cast) || text(info.actors),
    director: text(info.director),
    poster: poster(info.poster || info.movie_image || info.cover_big || info.stream_icon || info.cover || info['tvg-logo']),
  };
}
export function mergeMovieMetadata(base, extra) {
  const merged = { ...normalizeMovieMetadata(base) };
  for (const [key, value] of Object.entries(normalizeMovieMetadata(extra))) if (value !== null) merged[key] = value;
  return merged;
}
export function movieDuration(seconds) {
  if (!(seconds > 0)) return 'Not provided';
  const total = Math.max(1, Math.round(seconds / 60));
  return total >= 60 ? `${Math.floor(total / 60)}h${total % 60 ? ` ${total % 60}m` : ''}` : `${total}m`;
}
export function resumePosition(history, movie) {
  const entry = history.find(item => item.id === movie.id);
  if (!entry || !Number.isFinite(entry.position) || entry.position <= 0 || (entry.duration > 0 && entry.position >= entry.duration - 5)) return 0;
  return entry.position;
}
export function movieRouteId(movie) {
  if (movie.providerId != null || /^vod:/.test(movie.id)) return `vod:${movie.providerId ?? movie.id.slice(4)}`;
  // Keep credential-bearing M3U stream URLs out of navigation parameters.
  let first = 2166136261; let second = 3335557771;
  for (const char of String(movie.id)) {
    first = Math.imul(first ^ char.charCodeAt(0), 16777619);
    second = Math.imul(second ^ char.charCodeAt(0), 2246822519);
  }
  return `m3u:${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`;
}
export function applyMovieDetails(movie, details) {
  return { ...movie, ...details, metadata: mergeMovieMetadata(movie.metadata || {}, details.metadata || {}), addedAt: details.addedAt ?? movie.addedAt, url: details.url || movie.url };
}
