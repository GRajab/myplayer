import { addedTimestamp, normalizeMovieMetadata, mergeMovieMetadata } from '../utils/movies';
import { parsePlaybackUrl } from '../utils/playback';
export function validUrl(value) {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS URL.');
  return url.toString();
}
async function request(url, json = true, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort);
  const timeout = setTimeout(() => controller.abort(), 30000);
  try { const response = await fetch(url, { signal: controller.signal }); if (!response.ok) throw new Error('Provider request failed. Check your URL and credentials.'); return await (json ? response.json() : response.text()); }
  catch (error) { if (error.name === 'AbortError') throw new Error('The provider timed out. Please try again.'); throw new Error('Unable to load this provider. Check your connection, URL and credentials.'); }
  finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}
function m3uCategory(url, meta) {
  // Provider stream paths identify VOD even when groups are just a language/genre.
  const path = new URL(url).pathname;
  if (/^\/series\//i.test(path)) return 'series';
  if (/^\/movie\//i.test(path)) return 'vod';
  if (/^\/live\//i.test(path)) return 'live';
  if (/series|season|s\d+e\d+/i.test(meta.group + ' ' + meta.name)) return 'series';
  return /movie|vod|cinema/i.test(meta.group) || /\.(mp4|mkv|avi)$/i.test(path) ? 'vod' : 'live';
}
export function parseM3U(text, base) {
  if (!text.trimStart().startsWith('#EXTM3U')) throw new Error('This URL did not return an M3U playlist.');
  const items = []; let meta = null; let updatedAt = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('#EXTINF:')) {
      const attrs = {}; for (const match of line.matchAll(/([\w-]+)="([^"]*)"/g)) attrs[match[1]] = match[2];
      const comma = line.search(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      updatedAt = addedTimestamp(attrs.last_modified || attrs['last-modified'] || attrs['date-updated'] || attrs.updated);
      meta = { name: line.slice(comma + 1).trim() || attrs['tvg-name'] || 'Untitled', logo: attrs['tvg-logo'], group: attrs['group-title'] || 'Other', addedAt: addedTimestamp(attrs.added || attrs['date-added'] || attrs['tvg-added']), metadata: normalizeMovieMetadata({ ...attrs, duration_secs: Number(line.slice(8).match(/^-?\d+/)?.[0]) }) };
    } else if (meta && /^#EXTVLCOPT:http-(user-agent|referrer|referer)=/i.test(line)) {
      const match = line.match(/^#EXTVLCOPT:http-(user-agent|referrer|referer)=(.*)$/i);
      meta.headers = { ...meta.headers, [match[1].toLowerCase() === 'user-agent' ? 'User-Agent' : 'Referer']: match[2] };
    } else if (meta && line && !line.startsWith('#')) {
      try { const parsed = parsePlaybackUrl(line, base); const url = parsed.url; const category = m3uCategory(url, meta); items.push({ ...meta, ...(category === 'series' ? { updatedAt } : {}), url, headers: { ...meta.headers, ...parsed.headers }, category, id: url }); } catch { /* Skip unsupported stream protocols. */ }
      meta = null;
    }
  }
  return [...new Map(items.map(item => [item.id, item])).values()];
}
function api(config, action, extra = '') { return `${config.server.replace(/\/+$/, '')}/player_api.php?username=${encodeURIComponent(config.username)}&password=${encodeURIComponent(config.password)}${action ? `&action=${action}` : ''}${extra}`; }
function streamUrl(config, category, id, extension) { return `${config.server.replace(/\/+$/, '')}/${category}/${encodeURIComponent(config.username)}/${encodeURIComponent(config.password)}/${id}.${extension}`; }
export async function loadPlaylist(config) {
  if (config.type === 'm3u') { const items = parseM3U(await request(config.url, false), config.url); if (!items.length) throw new Error('No supported streams found in this playlist.'); return items; }
  const auth = await request(api(config)); if (Number(auth.user_info?.auth) !== 1) throw new Error('Provider rejected these credentials.');
  const result = await Promise.all(['live', 'vod', 'series'].map(async category => {
    const [groups, streams] = await Promise.all([request(api(config, `get_${category}_categories`)), request(api(config, category === 'series' ? 'get_series' : `get_${category}_streams`))]);
    if (!Array.isArray(groups) || !Array.isArray(streams)) throw new Error('Invalid provider response.');
    const names = new Map(groups.map(group => [String(group.category_id), group.category_name]));
    return streams.map(item => ({ id: `${category}:${item.stream_id ?? item.series_id}`, providerId: item.stream_id ?? item.series_id, addedAt: addedTimestamp(item.added), ...(category === 'series' ? { updatedAt: addedTimestamp(item.last_modified) } : {}), metadata: category === 'vod' ? normalizeMovieMetadata(item) : undefined, name: item.name, category, group: names.get(String(item.category_id)) || 'Other', logo: item.stream_icon || item.cover, isSeries: category === 'series', url: category === 'series' ? null : streamUrl(config, category === 'vod' ? 'movie' : 'live', item.stream_id, item.container_extension || (category === 'live' ? 'm3u8' : 'mp4')) }));
  }));
  const items = result.flat();
  if (!items.length) throw new Error('Provider returned an empty library. Please try loading the playlist again.');
  return items;
}
export async function loadSeriesDetails(config, item, signal) {
  const metadata = normalizeMovieMetadata(item.metadata || { name: item.name, cover: item.logo });
  if (!item.isSeries || config?.type !== 'xtream') return { metadata, episodes: item.url ? [{ ...item, season: 'unknown', episodeNumber: null, seriesId: item.id }] : [] };
  const response = await request(api(config, 'get_series_info', `&series_id=${encodeURIComponent(item.providerId)}`), true, signal);
  if (!response || typeof response.episodes !== 'object' || response.episodes === null) throw new Error('Series details unavailable.');
  return {
    metadata: mergeMovieMetadata(metadata, response.info || {}),
    episodes: Object.entries(response.episodes).flatMap(([season, entries]) => (Array.isArray(entries) ? entries : []).filter(episode => episode.id != null).map(episode => ({
      id: `episode:${episode.id}`, name: episode.title || `${item.name} · E${episode.episode_num || ''}`,
      category: 'series', group: item.name, logo: item.logo, seriesId: item.id,
      season: String(episode.season ?? season), episodeNumber: Number(episode.episode_num) || null,
      metadata: normalizeMovieMetadata(episode.info || {}),
      url: streamUrl(config, 'series', episode.id, /^[a-z0-9]+$/i.test(episode.container_extension || '') ? episode.container_extension : 'mp4'),
    }))),
  };
}
export async function loadEpisodes(config, item) { return (await loadSeriesDetails(config, item)).episodes; }

export async function loadMovieDetails(config, movie, signal) {
  const base = normalizeMovieMetadata(movie.metadata || { name: movie.name, stream_icon: movie.logo });
  if (config?.type !== 'xtream') return { metadata: base, addedAt: movie.addedAt ?? null, url: movie.url };
  const id = movie.providerId ?? movie.id.match(/^vod:(.+)$/)?.[1];
  if (id == null) return { metadata: base, addedAt: movie.addedAt ?? null, url: movie.url };
  const response = await request(api(config, 'get_vod_info', '&vod_id=' + encodeURIComponent(id)), true, signal);
  if (!response || (!response.info && !response.movie_data)) throw new Error('Movie details unavailable.');
  if (response.movie_data?.stream_id != null && String(response.movie_data.stream_id) !== String(id)) throw new Error('Movie details unavailable.');
  const metadata = mergeMovieMetadata(mergeMovieMetadata(base, response.movie_data || {}), response.info || {});
  const extension = response.movie_data?.container_extension;
  return { metadata, addedAt: addedTimestamp(response.movie_data?.added) ?? movie.addedAt ?? null, url: typeof extension === 'string' && /^[a-z0-9]+$/i.test(extension) ? streamUrl(config, 'movie', id, extension) : movie.url };
}
