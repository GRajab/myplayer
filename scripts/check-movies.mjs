import fs from 'node:fs';
import assert from 'node:assert/strict';
const url = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
const moviesUrl = url(fs.readFileSync('src/utils/movies.js', 'utf8'));
const playbackUrl = url(fs.readFileSync('src/utils/playback.js', 'utf8'));
const { FIVE_DAYS_MS, MOVIE_NEW, MOVIE_ALL, MOVIE_FAVORITES, addedTimestamp, recentlyAddedMovies, movieBrowseResults, normalizeMovieMetadata, mergeMovieMetadata, movieDuration, resumePosition, movieRouteId } = await import(moviesUrl);
const { loadMovieDetails, parseM3U, loadPlaylist } = await import(url(fs.readFileSync('src/services/playlist.js', 'utf8').replace("'../utils/movies'", JSON.stringify(moviesUrl)).replace("'../utils/playback'", JSON.stringify(playbackUrl))));
const now = Date.parse('2026-10-24T12:00:00Z');
const entries = [
  { id: 'old', category: 'vod', name: 'Old film', group: 'Drama', addedAt: now - FIVE_DAYS_MS - 1 },
  { id: 'recent', category: 'vod', name: 'Recent film', group: 'Drama', added: String((now - 1000) / 1000) },
  { id: 'boundary', category: 'vod', name: 'Boundary film', group: 'Comedy', addedAt: now - FIVE_DAYS_MS },
  { id: 'newest', category: 'vod', name: 'Latest film', group: 'Comedy', addedAt: now },
  { id: 'future', category: 'vod', name: 'Future film', group: 'Drama', addedAt: now + 1 },
  { id: 'missing', category: 'vod', name: 'Missing date', group: 'Drama', releaseDate: '2026-10-23', fetchedAt: now },
  { id: 'invalid', category: 'vod', name: 'Invalid date', group: 'Drama', addedAt: 'not a date' },
  { id: 'live', category: 'live', name: 'Live', group: 'Drama', addedAt: now },
];
assert.deepEqual(recentlyAddedMovies(entries, now).map(item => item.id), ['newest', 'recent', 'boundary']);
let result = movieBrowseResults(entries, ['recent', 'old'], '', MOVIE_NEW, now);
assert.equal(result.categories.find(item => item.id === MOVIE_NEW).count, 3);
assert.equal(result.results.length, 3);
result = movieBrowseResults(entries, [], 'Recent', MOVIE_NEW, now);
assert.equal(result.categories.find(item => item.id === MOVIE_NEW).count, 1);
assert.equal(result.results.length, 1);
assert.equal(movieBrowseResults(entries, ['recent', 'old'], '', MOVIE_FAVORITES, now).results.length, 2);
assert.equal(movieBrowseResults(entries, [], '', MOVIE_ALL, now).results.length, 7);
assert.equal(recentlyAddedMovies(entries, now + FIVE_DAYS_MS + 1).length, 1);
assert.equal(addedTimestamp(now / 1000), now);
assert.equal(addedTimestamp(String(now)), now);
assert.equal(addedTimestamp('2026-10-24T12:00:00Z'), now);
assert.equal(addedTimestamp(null), null);
assert.equal(addedTimestamp(''), null);
assert.equal(addedTimestamp('0'), null);
const metadata = normalizeMovieMetadata({ rating: '8.2', duration: '02:01:00', releasedate: '1999-03-31', cast: [{ name: 'Actor A' }, 'Actor B'], director: 'Director', plot: 'Story', movie_image: 'https://example.com/poster.jpg' });
assert.equal(metadata.durationSeconds, 7260);
assert.equal(metadata.cast, 'Actor A, Actor B');
assert.equal(metadata.releaseDate, '1999-03-31');
assert.equal(metadata.rating, 8.2);
assert.equal(movieDuration(metadata.durationSeconds), '2h 1m');
assert.equal(normalizeMovieMetadata({ rating: 'N/A', duration: '-1' }).rating, null);
assert.equal(normalizeMovieMetadata({ cast: 'null', director: 'N/A' }).cast, null);
assert.equal(normalizeMovieMetadata({}).durationSeconds, null);
assert.equal(movieDuration(null), 'Not provided');
assert.equal(mergeMovieMetadata(metadata, { cast: null }).cast, metadata.cast);
assert.equal(resumePosition([{ id: 'recent', position: 100, duration: 700 }], entries[1]), 100);
assert.equal(resumePosition([{ id: 'recent', position: 699, duration: 700 }], entries[1]), 0);
assert.equal(resumePosition([], entries[1]), 0);
assert.doesNotMatch(movieRouteId({ id: 'https://example.com/user/SECRET/film.mp4' }), /SECRET|example/);
const m3u = parseM3U('#EXTM3U\n#EXTINF:3600 group-title="Movies" added="' + String(now / 1000) + '" release-date="2020-01-01" genre="Drama",Movie\nhttps://example.com/movie.mp4', 'https://example.com/list.m3u');
assert.equal(m3u[0].addedAt, now);
assert.equal(m3u[0].metadata.durationSeconds, 3600);
assert.equal(m3u[0].metadata.releaseDate, '2020-01-01');
const fetchOriginal = globalThis.fetch;
const calls = [];
globalThis.fetch = async address => {
  const parsed = new URL(address); calls.push(parsed);
  const action = parsed.searchParams.get('action');
  let body;
  if (action === 'get_vod_info') body = { info: { plot: 'Provider story', director: 'A director', duration_secs: 7200, rating: 8 }, movie_data: { stream_id: 42, container_extension: 'mkv', added: String(now / 1000) } };
  else if (!action) body = { user_info: { auth: 1 } };
  else if (action.endsWith('_categories')) body = [{ category_id: 1, category_name: 'Drama' }];
  else body = action === 'get_vod_streams' ? [{ stream_id: 42, name: 'Movie', added: String(now / 1000), rating: '8.2', category_id: 1 }] : [];
  return { ok: true, json: async () => body };
};
try {
  const config = { type: 'xtream', server: 'https://example.com', username: 'user', password: 'password' };
  const library = await loadPlaylist(config);
  assert.equal(library[0].providerId, 42);
  assert.equal(library[0].addedAt, now);
  const details = await loadMovieDetails(config, library[0]);
  assert.equal(details.metadata.director, 'A director');
  assert.equal(details.metadata.summary, 'Provider story');
  assert.match(details.url, /42\.mkv$/);
  assert.equal(calls.at(-1).searchParams.get('vod_id'), '42');
  assert.ok(calls.every(call => call.pathname === '/player_api.php'), 'Browsing/details must not request a video URL');
  const before = calls.length;
  const missing = await loadMovieDetails({ type: 'm3u' }, { id: 'm3u', url: 'https://example.com/film.mp4' });
  assert.equal(calls.length, before);
  assert.equal(missing.metadata.summary, null);
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ movie_data: { stream_id: 999 }, info: { plot: 'Wrong movie' } }) });
  await assert.rejects(() => loadMovieDetails(config, library[0]), /unavailable/);
} finally { globalThis.fetch = fetchOriginal; }
console.log('Movie date boundaries, filtered counts, sorting, metadata, resume, M3U and Xtream details-only requests passed.');
const duplicate = movieBrowseResults([{ id: 'old-provider', name: 'Old provider movie', group: 'Newly Added', category: 'vod', addedAt: now - FIVE_DAYS_MS - 1 }], [], '', MOVIE_NEW, now);
assert.equal(duplicate.results.length, 0);
assert.equal(duplicate.categories.find(item => item.name === 'Newly Added').count, 0);
assert.equal(duplicate.categories.find(item => item.name === 'Newly Added · Provider').count, 1);
assert.equal(normalizeMovieMetadata({ releasedate: '0000-00-00' }).releaseDate, null);
const { applyMovieDetails } = await import(moviesUrl);
const freshMovie = { id: 'fresh', name: 'Fresh', category: 'vod', addedAt: now, url: 'https://example.com/fresh.mp4', metadata: { summary: 'Known summary' } };
const preserved = applyMovieDetails(freshMovie, { addedAt: null, url: null, metadata: { cast: 'Actor', summary: null } });
assert.equal(preserved.addedAt, now);
assert.equal(preserved.url, freshMovie.url);
assert.equal(preserved.metadata.summary, 'Known summary');
assert.equal(preserved.metadata.cast, 'Actor');
