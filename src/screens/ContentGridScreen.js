import { useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Text, TextInput, View, Pressable, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { Heart } from 'lucide-react-native';
import { router } from 'expo-router';
import { usePlayer } from '../state/PlayerContext';
import MoviesScreen from './MoviesScreen';
import SeriesPoster from '../components/SeriesPoster';
import { recentSeries, SERIES_RECENT } from '../utils/series';
import { movieRouteId } from '../utils/movies';
import { Page, Header, Button, s, colors } from '../components/ui';
import { CategoryPanel, CategoryOrganiser, FAVORITES_CATEGORY, ALL_CATEGORY, providerKey } from '../components/Categories';
import { normalizePreferences, categoryOrder, saveCategoryOrder } from '../utils/categories';

export default function ContentGridScreen() {
  const { selectedCategory, activePlaylistId } = usePlayer();
  return selectedCategory === 'vod' ? <MoviesScreen key={activePlaylistId} /> : <ChannelGridScreen key={`${activePlaylistId}:${selectedCategory}`} />;
}
function ChannelGridScreen() {
  const { items, selectedCategory, favorites, toggleFavorite, setCurrentStream, activePlaylistId, categoryPreferences, updateCategoryPreferences, storageError } = usePlayer();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState(null);
  const [categoryModal, setCategoryModal] = useState(null);
  const channelList = useRef(null);
  const live = selectedCategory === 'live';
  const width = useWindowDimensions().width;
  const narrow = width < 480;
  const [categoryRevision, setCategoryRevision] = useState(0);
  const sidebarWidth = Math.min(260, Math.max(116, width * (live ? 0.35 : 0.3)));
  const columns = live ? 1 : Math.max(1, Math.min(5, Math.floor((width - sidebarWidth - 28) / 165)));
  const library = useMemo(() => items.filter(item => item.category === selectedCategory), [items, selectedCategory]);
  const groups = useMemo(() => {
    const counts = new Map();
    library.forEach(item => counts.set(item.group, (counts.get(item.group) || 0) + 1));
    return [{ id: null, name: live ? 'All channels' : 'All series', count: library.length }, ...Array.from(counts, ([name, count]) => ({ id: name, name, count }))];
  }, [library, live]);
  const preferences = useMemo(() => normalizePreferences(categoryPreferences?.[selectedCategory]), [categoryPreferences, selectedCategory]);
  const names = useMemo(() => groups.filter(item => item.id !== null).map(item => item.name), [groups]);
  const orderedGroups = useMemo(() => {
    const byName = new Map(groups.map(item => [item.name, item]));
    return categoryOrder(names, preferences.order).map(name => byName.get(name));
  }, [groups, names, preferences.order]);
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const favoriteCount = useMemo(() => library.filter(item => favoriteSet.has(item.id)).length, [library, favoriteSet]);
  const recent = useMemo(() => live ? [] : recentSeries(library, query), [library, query, live]);
  const activeGroup = !live && group === SERIES_RECENT ? SERIES_RECENT : group === FAVORITES_CATEGORY ? FAVORITES_CATEGORY : orderedGroups.some(item => providerKey(item.name) === group && (preferences.showHidden || !preferences.hidden.includes(item.name))) ? group : ALL_CATEGORY;
  const selectedName = activeGroup === SERIES_RECENT ? 'Latest Updates' : activeGroup === FAVORITES_CATEGORY ? 'Favorites' : orderedGroups.find(item => providerKey(item.name) === activeGroup)?.name ?? (live ? 'All channels' : 'All series');
  const totalCount = useMemo(() => library.filter(item => preferences.showHidden || !preferences.hidden.includes(item.group)).length, [library, preferences]);
  const filtered = useMemo(() => activeGroup === SERIES_RECENT ? recent : library.filter(item => {
    const inCategory = activeGroup === FAVORITES_CATEGORY ? favoriteSet.has(item.id) : activeGroup === ALL_CATEGORY ? preferences.showHidden || !preferences.hidden.includes(item.group) : providerKey(item.group) === activeGroup;
    return inCategory && item.name.toLowerCase().includes(query.toLowerCase());
  }), [library, activeGroup, preferences, favoriteSet, query, recent]);
  const updatePreferences = update => updateCategoryPreferences(selectedCategory, old => update(normalizePreferences(old)));
  const changeOrder = order => updatePreferences(old => saveCategoryOrder(old, names, order));
  const toggleHidden = name => updatePreferences(old => ({ ...old, hidden: old.hidden.includes(name) ? old.hidden.filter(value => value !== name) : [...old.hidden, name] }));
  const showHidden = value => updatePreferences(old => ({ ...old, showHidden: value }));
  const resetOrder = () => updatePreferences(old => ({ ...old, order: names }));

  function chooseGroup(id) {
    setGroup(id);
    channelList.current?.scrollToOffset({ offset: 0, animated: false });
  }
  function finishOrganising() {
    setGroup(activeGroup);
    setCategoryModal(null);
    setCategoryRevision(value => value + 1);
    channelList.current?.scrollToOffset({ offset: 0, animated: false });
  }
  function play(item) {
    if (item.category === 'series') router.push({ pathname: '/series', params: { id: movieRouteId(item), playlistId: item.playlistId || activePlaylistId } });
    else { setCurrentStream(item, filtered); router.push('/player'); }
  }
  const panel = <CategoryPanel pinnedCategories={live ? [] : [{ id: SERIES_RECENT, name: "Latest Updates", count: recent.length }]} itemLabel={live ? "channels" : "series"} key={categoryRevision} groups={orderedGroups} preferences={preferences} selected={activeGroup} favoriteCount={favoriteCount} totalCount={totalCount} onSelect={id => { chooseGroup(id); setCategoryModal(null); }} onOrganise={() => setCategoryModal('organise')} onShowHidden={showHidden} />;

  const favorite = item => <Pressable accessibilityRole="button" accessibilityLabel={`Favorite ${item.name}`} accessibilityState={{ selected: favorites.includes(item.id) }} onPress={() => toggleFavorite(item.id)} style={styles.favorite}>
    <Heart size={22} color={colors.accent} fill={favorites.includes(item.id) ? colors.accent : 'transparent'} />
  </Pressable>;
  const channels = <FlatList ref={channelList} key={columns} numColumns={columns} data={filtered}
    style={{ flex: 1 }} keyExtractor={item => item.id} keyboardShouldPersistTaps="handled"
    contentContainerStyle={{ padding: live ? 8 : 14, paddingBottom: 40 }}
    ListEmptyComponent={<Text style={[s.muted, { padding: 12 }]}>{live ? 'No channels.' : 'No series.'}</Text>}
    renderItem={({ item }) => live ? <View style={styles.channel}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Play ${item.name}`} onPress={() => play(item)} style={styles.channelPlay}>
        {item.logo && !narrow ? <Image source={{ uri: item.logo }} style={styles.logo} resizeMode="contain" /> : null}
        <View style={{ flex: 1, gap: 4 }}><Text style={s.text} numberOfLines={2}>{item.name}</Text></View>
      </Pressable>
      {favorite(item)}
    </View> : <View style={[styles.seriesCard, { flex: 1, margin: 6, maxWidth: `${100 / columns - 2}%` }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.name}`} onPress={() => play(item)}>
        <SeriesPoster uri={item.logo} title={item.name} resizeMode="cover" style={{ borderRadius: 0 }} />
        <View style={{ padding: 10, gap: 4 }}><Text style={s.text} numberOfLines={2}>{item.name}</Text><Text style={s.muted} numberOfLines={1}>{item.group}</Text></View>
      </Pressable>{favorite(item)}
    </View>} />;

  return <Page>
    <View style={[s.body, { paddingBottom: 8, paddingTop: 12, gap: 10 }]}>
      <Header title={{ live: 'Live TV', vod: 'Movies', series: 'Series' }[selectedCategory]}>
        <Button title="Dashboard" onPress={() => router.replace('/')} />
      </Header>
      <TextInput accessibilityLabel="Search library" placeholder="Search" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={s.input} />
      {!!storageError && <Text accessibilityRole="alert" style={s.error}>{storageError}</Text>}
    </View>
    <View style={styles.browser}>
      <View style={[styles.sidebar, { width: sidebarWidth }]}>{panel}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' }}><View style={{ flex: 1 }}><Text style={s.text} numberOfLines={1}>{selectedName}</Text><Text style={s.muted}>{filtered.length.toLocaleString()}{activeGroup === SERIES_RECENT ? ' · Last 5 days' : ''}</Text></View></View>
        {channels}
      </View>
    </View>
    <Modal visible={categoryModal !== null} animationType="slide" onRequestClose={finishOrganising} presentationStyle="fullScreen">
      <Page><View accessibilityViewIsModal onAccessibilityEscape={finishOrganising} style={{ flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center', padding: 16, gap: 12 }}>
        {!!storageError && <Text accessibilityRole="alert" style={s.error}>{storageError}</Text>}
        <View style={[s.row, { justifyContent: 'space-between' }]}><Text accessibilityRole="header" style={s.heading}>Organise</Text><Button title="Done" onPress={finishOrganising} /></View>
        {<CategoryOrganiser groups={orderedGroups} preferences={preferences} onOrder={changeOrder} onToggleHidden={toggleHidden} onShowHidden={showHidden} onReset={resetOrder} />}
      </View></Page>
    </Modal>
  </Page>;
}

const styles = StyleSheet.create({
  seriesCard: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.panel },
  browser: { flex: 1, flexDirection: 'row', minHeight: 0 },
  sidebar: { backgroundColor: '#111C30', borderRightWidth: 1, borderColor: '#334155' },
  category: { padding: 12, minHeight: 60, gap: 6, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  categorySelected: { backgroundColor: '#1E293B', borderLeftColor: colors.accent },
  channel: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.panel, borderRadius: 12, marginBottom: 8, minHeight: 80 },
  channelPlay: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, minHeight: 80 },
  logo: { width: 36, height: 36 },
  favorite: { minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});


