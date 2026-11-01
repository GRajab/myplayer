import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ArrowLeft, Heart, Play } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { usePlayer } from '../state/PlayerContext';
import { loadSeriesDetails } from '../services/playlist';
import { movieDuration, movieRouteId, resumePosition } from '../utils/movies';
import SeriesPoster from '../components/SeriesPoster';
import { IconButton } from '../components/IconButton';
import { Page, Button, colors, s } from '../components/ui';

export default function SeriesDetailsScreen() {
  const params = useLocalSearchParams();
  const { playlists, activePlaylistId, setSelectedCategory } = usePlayer();
  const playlist = playlists.find(entry => entry.id === (params.playlistId || activePlaylistId));
  const series = playlist?.items.find(item => item.category === 'series' && movieRouteId(item) === params.id);
  function back() {
    setSelectedCategory('series');
    if (router.canGoBack()) router.back(); else router.replace('/content');
  }
  if (!series) return <Page><View style={s.body}><Text style={s.text}>Series unavailable.</Text><Button title="Back to series" onPress={back} /></View></Page>;
  return <Details key={`${playlist.id}:${series.id}`} series={series} playlist={playlist} onBack={back} />;
}
function Details({ series, playlist, onBack }) {
  const { setCurrentStream, toggleFavorite } = usePlayer();
  const [base] = useState(series);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [season, setSeason] = useState(null);
  const width = useWindowDimensions().width;
  const compact = width < 700;
  const roomy = width >= 1100;
  useEffect(() => {
    const controller = new AbortController();
    loadSeriesDetails(playlist.config, base, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult(data);
    }).catch(() => { if (!controller.signal.aborted) setError('Could not load episodes.'); });
    return () => controller.abort();
  }, [playlist.config, base, attempt]);
  const seasons = useMemo(() => [...new Set((result?.episodes || []).map(item => item.season))].sort((a, b) => Number(a) - Number(b)), [result]);
  const selected = seasons.includes(season) ? season : seasons[0];
  const episodes = useMemo(() => (result?.episodes || []).filter(item => item.season === selected).sort((a, b) => (a.episodeNumber ?? Infinity) - (b.episodeNumber ?? Infinity)), [result, selected]);
  const metadata = result?.metadata || base.metadata || {};
  const favorite = playlist.favorites.includes(series.id);
  function play(item) {
    setCurrentStream({ ...item, playlistId: playlist.id, position: resumePosition(playlist.history, item) });
    router.push('/player');
  }
  const seasonName = value => value === 'unknown' ? 'Episodes' : Number(value) === 0 ? 'Specials' : `Season ${value}`;
  const seasonCounts = new Map();
  for (const item of result?.episodes || []) seasonCounts.set(item.season, (seasonCounts.get(item.season) || 0) + 1);
  return <Page>
    <View style={styles.header}>
      <IconButton label="Back to series" icon={ArrowLeft} onPress={onBack} />
      <Text style={[s.muted, { flex: 1 }]} numberOfLines={1}>Series / {series.name}</Text>
      <IconButton label={favorite ? 'Remove series from favorites' : 'Favorite series'} icon={Heart} selected={favorite} onPress={() => toggleFavorite(series.id, playlist.id)} />
    </View>
    <View style={styles.columns}>
      <ScrollView style={styles.left} contentContainerStyle={[styles.details, { padding: compact ? 12 : roomy ? 32 : 20 }]}>
        <View style={[styles.hero, compact && { flexDirection: 'column' }]}>
          <SeriesPoster uri={metadata.poster || series.logo} title={series.name} resizeMode="cover" style={{ width: compact ? '72%' : roomy ? 180 : 136, alignSelf: compact ? 'center' : 'flex-start', flexShrink: 0 }} />
          <View style={[styles.heroInfo, compact && { flex: 0, width: '100%' }]}>
            <Text accessibilityRole="header" style={[styles.title, compact && { fontSize: 23 }]}>{metadata.title || series.name}</Text>
            <View style={styles.badges}>
              <Text style={styles.badge}>{metadata.releaseDate || 'Release not provided'}</Text>
              <Text style={[styles.badge, { color: '#FBBF24' }]}>{metadata.rating ? `★ ${metadata.rating}/10` : 'Rating not provided'}</Text>
              {!!result && <Text style={styles.badge}>{seasons.length} {seasons.length === 1 ? 'season' : 'seasons'}</Text>}
            </View>
            <Text style={s.muted}>{metadata.genre || 'Genre not provided'}</Text>
            <Text style={[s.text, { lineHeight: 23 }]}>{metadata.summary || 'Story not provided.'}</Text>
          </View>
        </View>
        <View style={styles.credits}><Info label="Cast" value={metadata.cast} /><Info label="Director" value={metadata.director} /></View>
        <View style={styles.sectionHeading}><Text accessibilityRole="header" style={s.heading}>Seasons</Text>{!!result && <Text style={s.muted}>{result.episodes.length} episodes</Text>}</View>
        <View style={styles.seasons}>
          {seasons.map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${seasonName(value)}, ${seasonCounts.get(value)} episodes`} accessibilityState={{ selected: value === selected }} onPress={() => setSeason(value)} style={({ pressed, focused }) => [styles.season, value === selected && styles.selectedSeason, (pressed || focused) && styles.focused]}>
            <Text style={[s.text, value === selected && { color: colors.accent }]}>{seasonName(value)}</Text>
            <Text style={s.muted}>{seasonCounts.get(value)}</Text>
          </Pressable>)}
        </View>
        {!result && !error && <Text style={s.muted}>Loading seasons…</Text>}
        {!!result && !seasons.length && <Text style={s.muted}>No seasons available.</Text>}
      </ScrollView>
      <View style={styles.right}>
        <View style={[styles.episodeHeader, { paddingHorizontal: compact ? 12 : 20 }]}>
          <Text accessibilityRole="header" style={s.heading}>{selected ? seasonName(selected) : 'Episodes'}</Text>
          <Text style={s.muted}>{result ? `${episodes.length} episodes` : 'Loading…'}</Text>
        </View>
        {!result && !error && <ActivityIndicator style={{ marginTop: 20 }} color={colors.accent} accessibilityLabel="Loading episodes" />}
        {!!error && <View style={{ padding: 12, gap: 8 }}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Button title="Retry" onPress={() => { setError(''); setAttempt(value => value + 1); }} /></View>}
        <FlatList style={{ flex: 1 }} key={selected || 'loading'} data={episodes} keyExtractor={item => item.id} contentContainerStyle={{ padding: compact ? 8 : 12, paddingBottom: 24 }} ListEmptyComponent={result ? <Text style={s.muted}>No episodes available.</Text> : null} renderItem={({ item, index }) => {
          const position = resumePosition(playlist.history, item);
          const history = playlist.history.find(entry => entry.id === item.id);
          const played = history?.duration > 0 ? Math.min(1, Math.max(0, history.position / history.duration)) : 0;
          return <Pressable accessibilityRole="button" accessibilityLabel={`${position ? 'Resume' : 'Play'} ${item.name}`} onPress={() => play(item)} style={({ pressed, focused }) => [styles.episode, (pressed || focused) && styles.focused]}>
            <View style={styles.episodeRow}>
              <Text style={styles.episodeNumber}>{String(item.episodeNumber ?? index + 1).padStart(2, '0')}</Text>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={s.text}>{item.name}</Text>
                <Text style={s.muted}>{position ? `Resume · ${Math.floor(position / 60)} min` : item.metadata?.durationSeconds ? movieDuration(item.metadata.durationSeconds) : 'Duration not provided'}</Text>
              </View>
              <Play color={colors.accent} size={20} />
            </View>
            {!!item.metadata?.summary && <Text style={s.muted} numberOfLines={2}>{item.metadata.summary}</Text>}
            {played > 0 && <View style={styles.progress}><View style={[styles.progressFill, { width: `${played * 100}%` }]} /></View>}
          </Pressable>;
        }} />
      </View>
    </View>
  </Page>;
}
function Info({ label, value }) { return <View style={{ gap: 4 }}><Text style={[s.muted, { fontSize: 12 }]}>{label}</Text><Text style={s.text}>{value || 'Not provided'}</Text></View>; }
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, minHeight: 54, borderBottomWidth: 1, borderColor: '#243248' },
  columns: { flex: 1, flexDirection: 'row', minHeight: 0 },
  left: { width: '50%', flexGrow: 0, flexShrink: 0, minWidth: 0, backgroundColor: '#101C30' },
  right: { width: '50%', flexGrow: 0, flexShrink: 0, minWidth: 0, borderLeftWidth: 1, borderColor: '#334155', backgroundColor: '#0B1323' },
  details: { gap: 22, paddingBottom: 32 },
  hero: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  heroInfo: { flex: 1, minWidth: 0, gap: 14 },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { color: '#CBD5E1', backgroundColor: '#253248', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6, fontSize: 12 },
  credits: { gap: 12 },
  sectionHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  seasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  season: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, padding: 12, borderRadius: 10, gap: 12, backgroundColor: colors.panel, borderWidth: 1, borderColor: '#334155' },
  selectedSeason: { backgroundColor: '#12334A', borderColor: colors.accent },
  focused: { backgroundColor: '#21415A', borderColor: colors.accent },
  episodeHeader: { gap: 5, paddingVertical: 16, borderBottomWidth: 1, borderColor: '#243248' },
  episode: { gap: 10, padding: 12, minHeight: 80, marginBottom: 8, borderRadius: 10, backgroundColor: '#172337', borderWidth: 1, borderColor: '#253248' },
  episodeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  episodeNumber: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  progress: { height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: '#334155' },
  progressFill: { height: 3, backgroundColor: colors.accent },
});
