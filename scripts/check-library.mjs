import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const categoriesUrl = url(fs.readFileSync('src/utils/categories.js', 'utf8'));
const playlistsUrl = url(fs.readFileSync('src/utils/playlists.js', 'utf8').replace("'./categories'", JSON.stringify(categoriesUrl)));
const storageUrl = url(fs.readFileSync('src/services/libraryStorage.js', 'utf8').replace("'../utils/playlists'", JSON.stringify(playlistsUrl)));
const { emptyLibrary, migrateLibrary, refreshEntry, upsertPlaylist, updatePlaylist } = await import(playlistsUrl);
const { createLibraryStorage } = await import(storageUrl);
const original = Object.freeze({ playlistConfig: { type: 'm3u', url: 'https://example.com/a.m3u' }, items: [{ id: '1', name: 'News', category: 'live', group: 'News' }], favorites: ['1'], history: [{ id: '1', position: 0 }], categoryPreferences: { live: { order: ['News'], hidden: [] } } });
const migrated = migrateLibrary(original);
assert.equal(migrated.playlists.length, 1);
assert.equal(migrated.defaultPlaylistId, 'legacy');
assert.deepEqual(migrated.playlists[0].favorites, ['1']);
assert.equal(migrated.activePlaylistId, 'legacy');
const second = refreshEntry({ id: 'two', name: 'Second', config: { type: 'm3u', url: 'https://example.com/b.m3u' }, favorites: [], history: [], hiddenChannels: [], categoryPreferences: {} }, [{ id: '1', name: 'Different channel', category: 'live', group: 'Sports' }]);
let state = upsertPlaylist(migrated, second);
assert.equal(state.playlists.length, 2);
assert.equal(state.defaultPlaylistId, 'legacy');
assert.equal(state.activePlaylistId, 'two');
assert.equal(migrateLibrary(state).activePlaylistId, 'legacy');
state = { ...state, defaultPlaylistId: 'two' };
assert.equal(migrateLibrary(state).activePlaylistId, 'two');
assert.equal(upsertPlaylist(emptyLibrary(), second).defaultPlaylistId, 'two');
state = updatePlaylist(state, 'two', entry => ({ ...entry, hiddenChannels: ['1'], name: 'Renamed' }));
assert.deepEqual(state.playlists[0].hiddenChannels, []);
assert.deepEqual(state.playlists[1].hiddenChannels, ['1']);
assert.deepEqual(state.playlists[0].favorites, ['1']);
assert.equal(state.playlists[1].name, 'Renamed');
assert.equal(original.items[0].name, 'News');
assert.equal(migrateLibrary({ ...state, defaultPlaylistId: 'missing' }).defaultPlaylistId, 'legacy');
const memory = new Map([['myplayer:v1', JSON.stringify(original)]]);
let catalogueWrites = 0;
const adapter = {
  getItem: async key => memory.get(key) ?? null,
  setItem: async (key, value) => { memory.set(key, value); },
  removeItem: async key => { memory.delete(key); },
  multiGet: async keys => keys.map(key => [key, memory.get(key) ?? null]),
  multiSet: async entries => { catalogueWrites += entries.length; entries.forEach(([key, value]) => memory.set(key, value)); },
  multiRemove: async keys => keys.forEach(key => memory.delete(key)),
};
const disk = createLibraryStorage(adapter);
const legacy = await disk.read();
assert.equal(legacy.defaultPlaylistId, 'legacy');
await disk.write(state);
assert.equal(memory.has('myplayer:v1'), false);
const restarted = await createLibraryStorage(adapter).read();
assert.equal(restarted.activePlaylistId, 'two');
assert.deepEqual(restarted.playlists[1].hiddenChannels, ['1']);
assert.equal(restarted.playlists[0].items[0].name, 'News');
assert.equal(restarted.playlists[1].items[0].name, 'Different channel');
const written = catalogueWrites;
await disk.write({ ...state, defaultPlaylistId: 'legacy' });
assert.equal(catalogueWrites, written, 'Changing default must not rewrite catalogues');
const large = Array.from({ length: 401 }, (_, index) => ({ id: String(index), name: 'Channel', category: 'live', group: 'News' }));
state = updatePlaylist(state, 'two', entry => refreshEntry(entry, large));
await disk.write(state);
const metadata = JSON.parse(memory.get('myplayer:library:v2'));
assert.equal(metadata.playlists[1].cacheParts, 3);
assert.equal(metadata.playlists[1].items, undefined);
assert.equal((await createLibraryStorage(adapter).read()).playlists[1].items.length, 401);
state = updatePlaylist(state, 'two', entry => refreshEntry(entry, large.slice(0, 2)));
await disk.write(state);
assert.equal(memory.has('myplayer:cache:two:2'), false);
assert.equal((await createLibraryStorage(adapter).read()).playlists[1].items.length, 2);
console.log('Playlist migration, names, defaults, restart selection, isolation, cache chunking and preference-only saves passed.');
const quotaMemory = new Map();
const quotaAdapter = { ...adapter, getItem: async key => quotaMemory.get(key) ?? null, setItem: async (key, value) => quotaMemory.set(key, value), removeItem: async key => quotaMemory.delete(key), multiRemove: async keys => keys.forEach(key => quotaMemory.delete(key)), multiSet: async () => { throw new Error('Cache full'); } };
const quotaDisk = createLibraryStorage(quotaAdapter);
assert.equal((await quotaDisk.write(state)).cacheAvailable, false);
const savedDespiteQuota = await createLibraryStorage(quotaAdapter).read();
assert.equal(savedDespiteQuota.playlists.length, 2);
assert.equal(savedDespiteQuota.defaultPlaylistId, 'two');
assert.equal(savedDespiteQuota.playlists[1].name, 'Renamed');
assert.equal(savedDespiteQuota.playlists[1].config.url, 'https://example.com/b.m3u');
assert.deepEqual(savedDespiteQuota.playlists[1].hiddenChannels, ['1']);
assert.equal(savedDespiteQuota.playlists[1].items.length, 0);
await quotaDisk.write(state);
assert.equal(JSON.parse(quotaMemory.get('myplayer:library:v2')).playlists[1].cacheParts, 0);
console.log('Named playlists and preferences remain saved when the optional channel cache is full.');

const savedCatalogue = { items: [{ id: 'l', category: 'live', group: 'News' }, { id: 'm', category: 'vod', group: 'Movies' }, { id: 's', category: 'series', group: 'Shows' }], categoryPreferences: {} };
const partial = [{ id: 'l2', category: 'live', group: 'News' }];
const retained = refreshEntry(savedCatalogue, partial, true);
assert.deepEqual(retained.items.map(item => item.id), ['l2', 'm', 's']);
assert.ok(retained.catalogueWarning);
assert.deepEqual(refreshEntry(savedCatalogue, partial).items, partial);
assert.equal(refreshEntry(savedCatalogue, savedCatalogue.items, true).catalogueWarning, '');
assert.deepEqual(savedCatalogue.items.map(item => item.id), ['l', 'm', 's']);
console.log('Partial background refresh preserves saved movie/series sections; explicit playlist changes remain independent.');

// Failed staging must preserve the committed catalogue, including after a restart.
const atomicMemory = new Map(); let failParts = false; let failMetadata = false;
const atomicAdapter = {
  getItem: async key => atomicMemory.get(key) ?? null,
  setItem: async (key, value) => { if (failMetadata) throw new Error('Metadata failure'); atomicMemory.set(key, value); },
  removeItem: async key => atomicMemory.delete(key),
  multiGet: async keys => keys.map(key => [key, atomicMemory.get(key) ?? null]),
  multiSet: async pairs => { for (const [key, value] of pairs) { atomicMemory.set(key, value); if (failParts) throw new Error('Partial write'); } },
  multiRemove: async keys => keys.forEach(key => atomicMemory.delete(key)),
};
const atomicDisk = createLibraryStorage(atomicAdapter);
const initial = { playlists: [{ id: 'stable', name: 'Saved', config: { type: 'xtream' }, items: savedCatalogue.items, favorites: [], history: [] }], defaultPlaylistId: 'stable' };
await atomicDisk.write(initial);
const beforeFailure = new Map(atomicMemory);
const replacement = { ...initial, playlists: [{ ...initial.playlists[0], items: [{ id: 'new', category: 'live' }] }] };
failParts = true;
assert.equal((await atomicDisk.write(replacement)).cacheAvailable, false);
assert.deepEqual((await createLibraryStorage(atomicAdapter).read()).playlists[0].items, savedCatalogue.items);
assert.deepEqual([...atomicMemory.keys()].sort(), [...beforeFailure.keys()].sort());
failParts = false; failMetadata = true;
await assert.rejects(() => atomicDisk.write(replacement), /Metadata failure/);
assert.deepEqual([...atomicMemory.entries()].sort(), [...beforeFailure.entries()].sort());
failMetadata = false;
await atomicDisk.write(replacement);
assert.deepEqual((await createLibraryStorage(atomicAdapter).read()).playlists[0].items, replacement.playlists[0].items);
const textHeavy = Array.from({ length: 20 }, (_, index) => ({ id: String(index), category: 'vod', summary: 'Long plot '.repeat(2000) }));
await atomicDisk.write({ ...initial, playlists: [{ ...initial.playlists[0], items: textHeavy }] });
assert.deepEqual((await createLibraryStorage(atomicAdapter).read()).playlists[0].items, textHeavy);
for (const [key, value] of atomicMemory) if (key.startsWith('myplayer:cache:')) assert.ok(value.length <= 80000);
console.log('Atomic cache writes preserve movies/series on partial/quota/metadata failures and split text-heavy catalogues by size.');
