import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadPlaylist, loadEpisodes } from '../services/playlist';
import { createLibraryStorage } from '../services/libraryStorage';
import { applyMovieDetails } from '../utils/movies';
import { emptyLibrary, refreshEntry, updatePlaylist, upsertPlaylist } from '../utils/playlists';
const Context = createContext(null);
export function PlayerProvider({ children }) {
  const [library, setLibrary] = useState(emptyLibrary);
  const [ready, setReady] = useState(false);
  const [canPersist, setCanPersist] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [playlistError, setPlaylistError] = useState('');
  const [loadingPlaylists, setLoadingPlaylists] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('live');
  const [movieBrowsing, setMovieBrowsing] = useState({});
  const updateMovieBrowsing = useCallback((id, value) => setMovieBrowsing(old => ({ ...old, [id]: value })), []);
  const cacheMovieDetails = useCallback((playlistId, id, details) => setLibrary(old => updatePlaylist(old, playlistId, entry => {
    const movie = entry.items.find(item => item.id === id);
    if (!movie) return entry;
    const updated = applyMovieDetails(movie, details);
    if (updated.addedAt === movie.addedAt && updated.url === movie.url && JSON.stringify(updated.metadata) === JSON.stringify(movie.metadata)) return entry;
    return { ...entry, items: entry.items.map(item => item.id === id ? updated : item) };
  })), []);
  const [currentStream, setCurrentStream] = useState(null);
  const [liveChannelList, setLiveChannelList] = useState(null);
  const [storage] = useState(() => createLibraryStorage(AsyncStorage));
  const writes = useRef(Promise.resolve());
  const requests = useRef(new Map());
  useEffect(() => {
    let mounted = true;
    async function restore() {
      try {
        const saved = await storage.read();
        if (!mounted) return;
        setLibrary(saved);
        setCanPersist(true);
        setReady(true);
        const entry = saved.playlists.find(item => item.id === saved.defaultPlaylistId);
        if (entry) {
          requests.current.set(entry.id, 1);
          setLoadingPlaylists(old => [...new Set([...old, entry.id])]);
          try {
            const items = await loadPlaylist(entry.config);
            if (mounted && requests.current.get(entry.id) === 1) setLibrary(old => updatePlaylist(old, entry.id, value => refreshEntry(value, items, true)));
          } catch (error) {
            if (mounted && requests.current.get(entry.id) === 1) setPlaylistError(error.message || 'Playlist unavailable.');
          } finally {
            if (mounted && requests.current.get(entry.id) === 1) setLoadingPlaylists(old => old.filter(id => id !== entry.id));
          }
        }
      } catch {
        if (mounted) { setStorageError('Saved playlists could not be read.'); setReady(true); }
      }
    }
    restore();
    return () => { mounted = false; };
  }, [storage]);
  useEffect(() => {
    if (ready && canPersist) writes.current = writes.current.then(async () => { const result = await storage.write(library); setStorageError(result.cacheAvailable ? '' : 'Offline cache could not be updated · Previous saved content retained when available.'); }).catch(() => setStorageError('Changes could not be saved.'));
  }, [library, ready, canPersist, storage]);
  const active = library.playlists.find(entry => entry.id === library.activePlaylistId);
  async function configure(config, options = {}) {
    const id = options.id || `list-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const version = (requests.current.get(id) || 0) + 1;
    requests.current.set(id, version);
    const items = await loadPlaylist(config);
    if (requests.current.get(id) !== version) return;
    setLibrary(old => {
      const existing = old.playlists.find(entry => entry.id === id);
      const entry = refreshEntry({ ...existing, id, name: options.name?.trim() || existing?.name || 'Playlist', config, favorites: existing?.favorites || [], history: existing?.history || [], hiddenChannels: existing?.hiddenChannels || [], categoryPreferences: existing?.categoryPreferences || {} }, items);
      return upsertPlaylist(old, entry, options.makeDefault);
    });
    setCanPersist(true); selectStream(null); setPlaylistError('');
  }
  async function activatePlaylist(id) {
    const entry = library.playlists.find(item => item.id === id);
    if (!entry) return;
    setLibrary(old => ({ ...old, activePlaylistId: id }));
    selectStream(null); setPlaylistError('');
    const version = (requests.current.get(id) || 0) + 1;
    requests.current.set(id, version);
    setLoadingPlaylists(old => [...new Set([...old, id])]);
    try {
      const items = await loadPlaylist(entry.config);
      if (requests.current.get(id) === version) setLibrary(old => updatePlaylist(old, id, value => refreshEntry(value, items, true)));
    } catch (error) { if (requests.current.get(id) === version) setPlaylistError(error.message || 'Playlist unavailable.'); }
    finally { if (requests.current.get(id) === version) setLoadingPlaylists(old => old.filter(value => value !== id)); }
  }
  const changeActive = update => setLibrary(old => updatePlaylist(old, old.activePlaylistId, update));
  const setDefaultPlaylist = id => setLibrary(old => old.playlists.some(entry => entry.id === id) ? { ...old, defaultPlaylistId: id } : old);
  const updateCategoryPreferences = (category, update) => changeActive(old => ({ ...old, categoryPreferences: { ...old.categoryPreferences, [category]: update(old.categoryPreferences?.[category]) } }));
  const toggleFavorite = (id, owner = library.activePlaylistId) => setLibrary(state => updatePlaylist(state, owner, old => ({ ...old, favorites: old.favorites.includes(id) ? old.favorites.filter(value => value !== id) : [...old.favorites, id] })));
  const record = (stream, position = 0, duration = 0) => {
    const owner = stream.playlistId || library.activePlaylistId;
    setLibrary(old => updatePlaylist(old, owner, entry => ({ ...entry, history: [{ ...stream, position, duration, watchedAt: Date.now() }, ...entry.history.filter(item => item.id !== stream.id)].slice(0, 30) })));
  };
  function selectStream(stream, channels = null) {
    setLiveChannelList(stream?.category === 'live' ? channels : null);
    setCurrentStream(stream ? { ...stream, playlistId: stream.playlistId || library.activePlaylistId } : null);
  }
  return <Context.Provider value={{ playlists: library.playlists, defaultPlaylistId: library.defaultPlaylistId, activePlaylistId: library.activePlaylistId, playlistConfig: active?.config || null, playlistName: active?.name || '', items: active?.items || [], favorites: active?.favorites || [], history: active?.history || [], categoryPreferences: active?.categoryPreferences || {}, hiddenChannels: active?.hiddenChannels || [], movieBrowsing, updateMovieBrowsing, cacheMovieDetails, ready, storageError, playlistLoading: loadingPlaylists.includes(library.activePlaylistId), playlistError: playlistError || active?.catalogueWarning || '', selectedCategory, setSelectedCategory, currentStream, liveChannelList, setCurrentStream: selectStream, configure, activatePlaylist, setDefaultPlaylist, toggleFavorite, updateCategoryPreferences, record, episodes: item => loadEpisodes(active.config, item) }}>{children}</Context.Provider>;
}
export const usePlayer = () => useContext(Context);
