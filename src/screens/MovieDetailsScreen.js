import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ArrowLeft, Heart } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { usePlayer } from '../state/PlayerContext';
import { loadMovieDetails } from '../services/playlist';
import { mergeMovieMetadata, movieDuration, movieRouteId, resumePosition } from '../utils/movies';
import MoviePoster from '../components/MoviePoster';
import { IconButton } from '../components/IconButton';
import { Page, Button, colors, s } from '../components/ui';
export default function MovieDetailsScreen() {
  const params = useLocalSearchParams();
  const { playlists, activePlaylistId, setSelectedCategory } = usePlayer();
  const playlistId = typeof params.playlistId === 'string' ? params.playlistId : activePlaylistId;
  const id = typeof params.id === 'string' ? params.id : '';
  const playlist = playlists.find(entry => entry.id === playlistId);
  const movie = playlist?.items.find(item => item.category === 'vod' && movieRouteId(item) === id);
  function back() {
    if (router.canGoBack()) router.back();
    else { setSelectedCategory('vod'); router.replace('/content'); }
  }
  if (!movie) return <Page><View style={s.body}><Text style={s.text}>Movie unavailable.</Text><Button title="Back to movies" onPress={back} /></View></Page>;
  return <Details key={`${playlistId}:${id}`} movie={movie} playlist={playlist} onBack={back} />;
}
function Details({ movie, playlist, onBack }) {
  const { toggleFavorite, setCurrentStream, cacheMovieDetails } = usePlayer();
  const [base] = useState(movie);
  const [response, setResponse] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const wide = useWindowDimensions().width >= 760;
  useEffect(() => {
    const controller = new AbortController();
    loadMovieDetails(playlist.config, base, controller.signal).then(details => {
      if (controller.signal.aborted) return;
      setResponse(details);
      if (playlist.config.type === 'xtream') cacheMovieDetails(playlist.id, base.id, details);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [playlist.config, playlist.id, base, attempt, cacheMovieDetails]);
  const metadata = mergeMovieMetadata(movie.metadata || { name: movie.name, stream_icon: movie.logo }, response?.metadata || {});
  const title = metadata.title || movie.name || 'Title not provided';
  const fullMovie = { ...movie, ...response, playlistId: playlist.id };
  const position = resumePosition(playlist.history, movie);
  const favorite = playlist.favorites.includes(movie.id);
  function play() {
    setCurrentStream({ ...fullMovie, position });
    router.push('/player');
  }
  const controls = <View style={[s.row, { flexWrap: 'nowrap' }]}><View style={{ flex: 1 }}><Button title={position > 0 ? 'Resume' : 'Play'} disabled={!fullMovie.url} onPress={play} /></View><IconButton label={favorite ? 'Remove from favorites' : 'Add to favorites'} icon={Heart} selected={favorite} onPress={() => toggleFavorite(movie.id, playlist.id)} /></View>;
  const poster = <MoviePoster uri={metadata.poster || movie.logo} title={title} style={wide ? { width: '100%' } : { width: 230, alignSelf: 'center' }} />;
  return <Page>
    <View style={{ paddingHorizontal: 16, paddingVertical: 8, alignItems: 'flex-start' }}><IconButton label="Back to movies" icon={ArrowLeft} onPress={onBack} /></View>
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
      <View style={{ width: '100%', maxWidth: 1200, alignSelf: 'center', flexDirection: wide ? 'row' : 'column', alignItems: 'flex-start', gap: 28 }}>
        <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 20 }}>
          {!wide && poster}
          <Text accessibilityRole="header" style={[s.title, { fontSize: wide ? 36 : 28 }]}>{title}</Text>
          <View style={{ gap: 14 }}>
            <Field label="Release date" value={metadata.releaseDate} />
            <Field label="Duration" value={movieDuration(metadata.durationSeconds)} />
            <Field label="Rating" value={metadata.rating != null ? `${metadata.rating}/10` : null} />
            <Field label="Genre" value={metadata.genre} />
          </View>
          {wide && controls}
          {!fullMovie.url && <Text style={s.muted}>Stream not provided.</Text>}
          <Field label="Story" value={metadata.summary} />
          <Field label="Cast" value={metadata.cast} />
          <Field label="Director" value={metadata.director} />
          {!response && !failed && <ActivityIndicator accessibilityLabel="Loading movie details" color={colors.accent} />}
          {failed && <View style={{ gap: 8 }}><Text style={s.muted}>More details unavailable.</Text><Button title="Retry details" onPress={() => { setResponse(null); setFailed(false); setAttempt(value => value + 1); }} /></View>}
        </View>
        {wide && <View style={{ width: '36%', maxWidth: 420 }}>{poster}</View>}
      </View>
    </ScrollView>
    {!wide && <View style={styles.footer}>{controls}</View>}
  </Page>;
}
function Field({ label, value }) {
  return <View style={{ gap: 5 }}><Text style={s.muted}>{label}</Text><Text style={[s.text, { lineHeight: 24 }]}>{value || 'Not provided'}</Text></View>;
}
const styles = StyleSheet.create({ footer: { padding: 16, borderTopWidth: 1, borderColor: '#334155', backgroundColor: colors.bg } });
