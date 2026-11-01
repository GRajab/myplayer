import { migrateLibrary } from '../utils/playlists';
const KEY = 'myplayer:library:v2';
const PART_SIZE = 150;
const MAX_PART_CHARACTERS = 80000; // Conservative UTF-8 size below Android cursor limits.
const partKey = (id, index, generation) => `myplayer:cache:${id}:${generation ? generation + ':' : ''}${index}`;
const keysFor = (id, snapshot) => Array.from({ length: snapshot?.parts || 0 }, (_, index) => partKey(id, index, snapshot.generation));
function chunks(items) {
  const parts = []; let rows = []; let length = 2;
  for (const item of items) {
    const json = JSON.stringify(item);
    if (rows.length && (rows.length >= PART_SIZE || length + json.length + 1 > MAX_PART_CHARACTERS)) { parts.push('[' + rows.join(',') + ']'); rows = []; length = 2; }
    rows.push(json); length += json.length + 1;
  }
  if (rows.length) parts.push('[' + rows.join(',') + ']');
  return parts;
}
export function createLibraryStorage(storage) {
  const cached = new Map();
  const cleanup = async keys => { if (keys.length) { try { await storage.multiRemove(keys); } catch { /* Cleanup can be retried; never discard a committed snapshot. */ } } };
  return {
    async read() {
      const raw = await storage.getItem(KEY);
      if (!raw) {
        const legacy = await storage.getItem('myplayer:v1');
        return migrateLibrary(legacy ? JSON.parse(legacy) : null);
      }
      const metadata = JSON.parse(raw);
      const playlists = await Promise.all((metadata.playlists || []).map(async entry => {
        const snapshot = { parts: entry.cacheParts || 0, generation: entry.cacheGeneration };
        const keys = keysFor(entry.id, snapshot);
        const parts = keys.length ? await storage.multiGet(keys) : [];
        const items = parts.flatMap(([, value]) => value ? JSON.parse(value) : []);
        cached.set(entry.id, { ...snapshot, items });
        return { ...entry, items };
      }));
      return migrateLibrary({ ...metadata, playlists });
    },
    async write(state) {
      const playlists = []; const staged = []; const obsolete = []; const committed = new Map();
      let cacheAvailable = true;
      for (const entry of state.playlists) {
        const previous = cached.get(entry.id);
        let snapshot = previous || { items: [], parts: 0, generation: undefined };
        if (previous?.items !== entry.items) {
          const generation = Date.now().toString(36) + Math.random().toString(36).slice(2);
          const values = chunks(entry.items);
          const next = { generation, parts: values.length, items: entry.items };
          const keys = keysFor(entry.id, next);
          try {
            if (keys.length) await storage.multiSet(keys.map((key, index) => [key, values[index]]));
            staged.push(...keys); obsolete.push(...keysFor(entry.id, previous));
            snapshot = next;
          } catch {
            await cleanup(keys);
            cacheAvailable = false;
            // Keep the previous catalogue and its metadata when staging fails.
          }
        }
        if (entry.items.length && !snapshot.parts) cacheAvailable = false;
        committed.set(entry.id, snapshot);
        const { items: _items, ...metadata } = entry;
        playlists.push({ ...metadata, cacheParts: snapshot.parts, cacheGeneration: snapshot.generation });
      }
      try { await storage.setItem(KEY, JSON.stringify({ ...state, playlists })); }
      catch (error) { await cleanup(staged); throw error; }
      for (const [id, snapshot] of committed) cached.set(id, snapshot);
      await cleanup(obsolete);
      await storage.removeItem('myplayer:v1');
      return { cacheAvailable };
    },
  };
}
