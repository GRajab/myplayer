import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { ArrowLeft, Heart, Pin } from 'lucide-react-native';
import { router } from 'expo-router';
import { usePlayer } from '../state/PlayerContext';
import { IconButton } from '../components/IconButton';
import MoviePoster from '../components/MoviePoster';
import { Page, colors, s } from '../components/ui';
import { MOVIE_ALL, MOVIE_NEW, MOVIE_FAVORITES, movieBrowseResults, movieRouteId } from '../utils/movies';
const EMPTY_BROWSE = { category: MOVIE_ALL, query: '', categoryQuery: '', offset: 0 };
export default function MoviesScreen() {
  const { items, favorites, toggleFavorite, activePlaylistId, movieBrowsing, updateMovieBrowsing } = usePlayer();
  const browse = movieBrowsing[activePlaylistId] || EMPTY_BROWSE;
  const [now, setNow] = useState(Date.now);
  const list = useRef(null);
  const offset = useRef(browse.offset);
  const width = useWindowDimensions().width;
  const sidebarWidth = Math.min(260, Math.max(116, width * 0.3));
  const columns = Math.max(1, Math.min(5, Math.floor((width - sidebarWidth - 20) / 160)));
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const { categories, results, selected } = useMemo(() => movieBrowseResults(items, favorites, browse.query, browse.category, now), [items, favorites, browse.query, browse.category, now]);
  const pinned = categories.slice(0, 2);
  const groups = categories.slice(2).filter(item => item.id === MOVIE_ALL || item.name.toLowerCase().includes(browse.categoryQuery.toLowerCase()));
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') setNow(Date.now()); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  function changeBrowse(change) {
    updateMovieBrowsing(activePlaylistId, { ...browse, ...change, offset: 0 });
    offset.current = 0;
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }
  function openDetails(movie) {
    updateMovieBrowsing(activePlaylistId, { ...browse, offset: offset.current });
    router.push({ pathname: '/movie', params: { id: movieRouteId(movie), playlistId: activePlaylistId } });
  }
  const choice = item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.count} movies`} accessibilityState={{ selected: selected === item.id }} onPress={() => changeBrowse({ category: item.id })} style={[styles.category, selected === item.id && styles.selected]}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Text numberOfLines={2} style={[s.text, { flex: 1, fontSize: 14 }]}>{item.name}</Text>{item.id === MOVIE_NEW && <Pin size={14} color={colors.accent} />}{item.id === MOVIE_FAVORITES && <Heart size={14} color={colors.accent} />}</View><Text style={s.muted}>{item.count.toLocaleString()}</Text>
  </Pressable>;
  return <Page>
    <View style={[s.row, { paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'space-between' }]}><Text style={s.title}>Movies</Text><IconButton label="Dashboard" icon={ArrowLeft} onPress={() => router.replace('/')} /></View>
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={[styles.sidebar, { width: sidebarWidth }]}>
        <View style={{ gap: 6 }}>{pinned.map(choice)}</View>
        <TextInput accessibilityLabel="Search movie categories" placeholder="Search" placeholderTextColor={colors.muted} value={browse.categoryQuery} onChangeText={categoryQuery => updateMovieBrowsing(activePlaylistId, { ...browse, categoryQuery })} style={[s.input, styles.search]} />
        <FlatList data={groups} keyExtractor={item => item.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingBottom: 24 }} renderItem={({ item }) => choice(item)} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <TextInput accessibilityLabel="Search movies" placeholder="Search movies" placeholderTextColor={colors.muted} value={browse.query} onChangeText={query => changeBrowse({ query })} style={[s.input, { margin: 10, padding: 12, minHeight: 48 }]} />
        <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}><Text numberOfLines={2} style={s.text}>{categories.find(item => item.id === selected)?.name} · {results.length.toLocaleString()}</Text></View>
        <FlatList ref={list} key={columns} numColumns={columns} data={results} keyExtractor={item => item.id} keyboardShouldPersistTaps="handled" contentOffset={{ x: 0, y: browse.offset }} onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={100} contentContainerStyle={{ padding: 4, paddingBottom: 24 }}
          ListEmptyComponent={<Text style={[s.muted, { padding: 12 }]}>{selected === MOVIE_NEW ? 'No movies with an added date in the last five days.' : 'No movies found.'}</Text>}
          renderItem={({ item }) => <View style={{ width: `${100 / columns}%`, padding: 6 }}>
            <View style={styles.card}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Details for ${item.name}`} onPress={() => openDetails(item)} style={{ gap: 10 }}>
                <MoviePoster uri={item.metadata?.poster || item.logo} title={item.name} />
                <Text style={s.text} numberOfLines={2}>{item.name || 'Title not provided'}</Text>
              </Pressable>
              <View style={{ alignItems: 'flex-end' }}><IconButton label={`${favoriteSet.has(item.id) ? 'Remove' : 'Add'} ${item.name} ${favoriteSet.has(item.id) ? 'from' : 'to'} favorites`} icon={Heart} selected={favoriteSet.has(item.id)} onPress={() => toggleFavorite(item.id)} /></View>
            </View>
          </View>} />
      </View>
    </View>
  </Page>;
}
const styles = StyleSheet.create({
  sidebar: { backgroundColor: '#111C30', borderRightWidth: 1, borderColor: '#334155', padding: 6, gap: 8 },
  category: { backgroundColor: colors.panel, padding: 8, minHeight: 60, gap: 6, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  selected: { borderColor: colors.accent, backgroundColor: '#075985' },
  search: { padding: 8, minHeight: 44, fontSize: 14 },
  card: { backgroundColor: colors.panel, padding: 8, borderRadius: 14, gap: 4 },
});
