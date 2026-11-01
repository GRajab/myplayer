/* eslint-disable react-hooks/immutability -- expo-video exposes mutable native player properties for volume, seeking, and track selection. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { usePlayer } from '../state/PlayerContext';
import { playbackSource, alternateLiveUrl, playbackFailure } from '../utils/playback';
import OnDemandPlayerControls from '../components/OnDemandPlayerControls';
import { movieRouteId } from '../utils/movies';
import { clampPlaybackPosition } from '../utils/playerControls';
import { Page, Button, s } from '../components/ui';

export default function PlayerScreen() {
  const { currentStream } = usePlayer();
  const [attempt, setAttempt] = useState(0);
  let invalidSource = false;
  if (currentStream) { try { playbackSource(currentStream); } catch { invalidSource = true; } }
  if (!currentStream || invalidSource) return <Page><View style={s.body}>
    <Text style={s.text}>{invalidSource ? 'This channel has no supported stream URL.' : 'Choose a stream from your library.'}</Text>
    <Button title="Dashboard" onPress={() => router.replace('/')} />
  </View></Page>;
  return <StreamPlayer key={`${currentStream.id}:${attempt}`} stream={currentStream} retry={() => setAttempt(value => value + 1)} />;
}

function StreamPlayer({ stream, retry }) {
  const { record, playlists, setSelectedCategory } = usePlayer();
  const onDemand = stream.category === 'vod' || stream.category === 'series';
  const series = stream.category === 'series';
  const config = playlists.find(entry => entry.id === stream.playlistId)?.config;
  const [alternate, setAlternate] = useState(false);
  const alternateUrl = alternateLiveUrl(stream, config);
  const selectedUrl = alternate && alternateUrl ? alternateUrl : stream.url;
  const source = useMemo(() => playbackSource({ ...stream, url: selectedUrl }), [stream, selectedUrl]);
  const [renderedUrl, setRenderedUrl] = useState(null);
  const [timedOutUrl, setTimedOutUrl] = useState(null);
  const frameRendered = renderedUrl === selectedUrl;
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState !== 'background');
  const [paused, setPaused] = useState(false);
  const [volume, setVolume] = useState(1);
  const [controlsOpen, setControlsOpen] = useState(!onDemand);
  const [interaction, setInteraction] = useState(0);
  const [touching, setTouching] = useState(false);
  const [panelHeight, setPanelHeight] = useState(320);
  const [slide] = useState(() => new Animated.Value(onDemand ? 0 : 1));
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [timeline, setTimeline] = useState({ position: stream.position || 0, duration: 0, buffered: 0 });
  const [trackMenu, setTrackMenu] = useState(null);
  const progress = useRef({ position: stream.position || 0, duration: 0 });
  const save = useRef(record);
  const restored = useRef(false);
  const player = useVideoPlayer(source, instance => {
    instance.timeUpdateEventInterval = 1;
    instance.play();
  });
  const { status, error: nativeError } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const stalled = !frameRendered && timedOutUrl === selectedUrl;
  const failed = status === 'error' || stalled;
  const { availableAudioTracks: audio } = useEvent(player, 'availableAudioTracksChange', { availableAudioTracks: player.availableAudioTracks });
  const { availableSubtitleTracks: subtitles } = useEvent(player, 'availableSubtitleTracksChange', { availableSubtitleTracks: player.availableSubtitleTracks });
  const { audioTrack } = useEvent(player, 'audioTrackChange', { audioTrack: player.audioTrack });
  const { subtitleTrack } = useEvent(player, 'subtitleTrackChange', { subtitleTrack: player.subtitleTrack });

  useEffect(() => { save.current = record; }, [record]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (focused && active && !paused && status !== 'error') player.play();
    else player.pause();
  }, [player, focused, active, paused, status]);
  useEffect(() => { player.volume = volume; }, [player, volume]);
  useEffect(() => {
    if (status === 'readyToPlay' && !restored.current) {
      restored.current = true;
      if (stream.category !== 'live' && stream.position > 0) player.currentTime = stream.position;
    }
  }, [player, status, stream.category, stream.position]);
  useEventListener(player, 'sourceLoad', ({ duration }) => {
    if (onDemand) setTimeline(old => ({ ...old, duration: Number.isFinite(duration) && duration > 0 ? duration : 0 }));
  });
  useEventListener(player, 'timeUpdate', ({ currentTime, bufferedPosition }) => {
    progress.current = { position: currentTime, duration: Number.isFinite(player.duration) ? player.duration : 0 };
    if (onDemand) setTimeline({ ...progress.current, buffered: Number.isFinite(bufferedPosition) ? bufferedPosition : 0 });
  });
  useEventListener(player, 'playToEnd', () => {
    progress.current.position = 0;
    save.current(stream, 0, progress.current.duration);
    setPaused(true);
    if (onDemand) { setTimeline(old => ({ ...old, position: old.duration })); setControlsOpen(true); }
  });
  useEffect(() => {
    const persist = () => save.current(stream, progress.current.position, progress.current.duration);
    persist();
    const timer = setInterval(persist, 10000);
    return () => { clearInterval(timer); persist(); };
  }, [stream]);

  useEffect(() => {
    if (frameRendered || paused || !focused || !active || status === 'error') return;
    const timer = setTimeout(() => setTimedOutUrl(selectedUrl), 25000);
    return () => clearTimeout(timer);
  }, [frameRendered, paused, focused, active, status, selectedUrl]);

  // Movies and series hide all chrome, including while paused; failed streams retain recovery controls.
  const visible = controlsOpen || (!onDemand && paused) || failed;
  useEffect(() => {
    if (!visible || failed || !focused || !active || touching) return;
    if (!onDemand && (paused || !frameRendered || !isPlaying || status !== 'readyToPlay')) return;
    const timer = setTimeout(() => { setControlsOpen(false); if (onDemand) setTrackMenu(null); }, onDemand ? 2000 : 4000);
    return () => clearTimeout(timer);
  }, [visible, paused, status, focused, active, touching, interaction, frameRendered, isPlaying, onDemand, failed]);
  useEffect(() => {
    const animation = Animated.timing(slide, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [slide, visible]);
  const interact = () => setInteraction(value => value + 1);
  function showControls() {
    setTrackMenu(null);
    setControlsOpen(true);
    interact();
  }

  function togglePlay() {
    if (paused && progress.current.position === 0 && stream.category !== 'live') player.currentTime = 0;
    setPaused(value => !value);
  }
  function seekVideo(position) {
    const next = clampPlaybackPosition(position, player.duration);
    if (next === null || status !== 'readyToPlay' || player.isLive) return;
    player.currentTime = next;
    progress.current = { position: next, duration: player.duration };
    setTimeline(old => ({ ...old, position: next, duration: player.duration }));
    interact();
  }
  function backToLibrary() {
    player.pause();
    save.current(stream, progress.current.position, progress.current.duration);
    setSelectedCategory(series ? 'series' : 'vod');
    const parent = series && playlists.find(entry => entry.id === stream.playlistId)?.items.find(item => item.id === stream.seriesId);
    if (parent) router.dismissTo({ pathname: '/series', params: { id: movieRouteId(parent), playlistId: stream.playlistId } });
    else router.dismissTo('/content');
  }

  return <View style={{ flex: 1, backgroundColor: '#000' }}>
    <StatusBar hidden />
    <VideoView player={player} surfaceType="textureView" onFirstFrameRender={() => setRenderedUrl(selectedUrl)} nativeControls={false} contentFit="contain" style={{ position: 'absolute', width: '100%', height: '100%' }} />
    {onDemand && <Pressable accessibilityRole="button" accessibilityLabel={series ? "Show episode controls" : "Show movie controls"} accessibilityState={{ expanded: visible }} onPress={showControls} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />}
    {(!frameRendered || status === 'loading' || status === 'idle') && !failed && <View pointerEvents="none" style={{ position: 'absolute', alignSelf: 'center', top: '40%', backgroundColor: '#000000AA', padding: 14, borderRadius: 12 }}><Text style={s.text}>{paused ? 'Paused' : status === 'readyToPlay' ? 'Starting video…' : 'Connecting…'}</Text></View>}
    {onDemand ? <OnDemandPlayerControls backLabel={series ? "Back to series" : "Back to movies"} progressLabel={series ? "Episode progress" : "Movie progress"} visible={visible} opacity={slide} insets={insets} height={height} title={stream.name} paused={paused} onTogglePlay={togglePlay} volume={volume} onVolume={setVolume} timeline={timeline} onSeek={seekVideo} seekable={timeline.duration > 0 && status === 'readyToPlay' && !player.isLive} onBack={backToLibrary} onInteract={interact} onTouching={setTouching} failed={failed} error={status === 'error' ? playbackFailure(nativeError) : 'No video received after 25 seconds.'} onRetry={retry} audio={audio} subtitles={subtitles} audioTrack={audioTrack} subtitleTrack={subtitleTrack} onAudio={track => { player.audioTrack = track; }} onSubtitle={track => { player.subtitleTrack = track; }} trackMenu={trackMenu} onTrackMenu={setTrackMenu} /> : <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      onLayout={event => setPanelHeight(event.nativeEvent.layout.height)}
      onTouchStart={() => { setTouching(true); interact(); }}
      onTouchEnd={() => { setTouching(false); interact(); }}
      onTouchCancel={() => { setTouching(false); interact(); }}
      onFocus={interact}
      style={{ position: 'absolute', left: Math.max(12, insets.left), right: Math.max(12, insets.right), bottom: onDemand ? Math.max(12, insets.bottom) : 52 + insets.bottom, maxHeight: height * 0.7, backgroundColor: '#0F172AF2', borderRadius: 16, overflow: 'hidden', opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [panelHeight + 70, 0] }) }] }}>
      <ScrollView keyboardShouldPersistTaps="handled" onScrollBeginDrag={interact} onScrollEndDrag={interact} contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={s.row}>
          <Button title="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />
          <Text style={[s.heading, { flex: 1 }]} numberOfLines={2}>{stream.name}</Text>
          {!paused && !failed && frameRendered && <Button title="Hide controls" onPress={() => setControlsOpen(false)} />}
        </View>
        {failed && <>
          <Text accessibilityRole="alert" style={s.error}>{status === 'error' ? playbackFailure(nativeError) : 'No video received after 25 seconds.'}</Text>
          <Button title="Retry" onPress={retry} />
          {!!alternateUrl && <Button title="Try alternate stream" onPress={() => { setAlternate(value => !value); setTimedOutUrl(null); setRenderedUrl(null); setPaused(false); }} />}
        </>}
        <View style={s.row}>
          <Button title={paused ? 'Play' : 'Pause'} onPress={() => {
            if (paused && progress.current.position === 0 && stream.category !== 'live') player.currentTime = 0;
            setPaused(value => !value);
          }} />
          <Button title={volume ? 'Mute' : 'Unmute'} onPress={() => setVolume(value => value ? 0 : 1)} />
          <Button title="Volume −" onPress={() => setVolume(value => Math.max(0, value - 0.1))} />
          <Text style={s.text}>{Math.round(volume * 100)}%</Text>
          <Button title="Volume +" onPress={() => setVolume(value => Math.min(1, value + 0.1))} />
        </View>
        <Text style={s.muted}>Audio{!audio.length ? ' · None reported by stream' : ''}</Text>
        <View style={s.row}>{audio.map((track, index) => <Button key={track.id ?? index}
          title={(sameTrack(audioTrack, track) ? '✓ ' : '') + (track.label || track.language || ('Track ' + (index + 1)))}
          onPress={() => { player.audioTrack = track; }} />)}</View>
        <Text style={s.muted}>Embedded subtitles{!subtitles.length ? ' · None reported by stream' : ''}</Text>
        <View style={s.row}>
          <Button title={!subtitleTrack ? '✓ Off' : 'Off'} onPress={() => { player.subtitleTrack = null; }} />
          {subtitles.map((track, index) => <Button key={track.id ?? index}
            title={(sameTrack(subtitleTrack, track) ? '✓ ' : '') + (track.label || track.language || ('Subtitle ' + (index + 1)))}
            onPress={() => { player.subtitleTrack = track; }} />)}
        </View>
      </ScrollView>
    </Animated.View>}
    {!onDemand && <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Player controls open' : 'Show player controls'} accessibilityState={{ expanded: visible }}
      onPress={() => { setControlsOpen(true); interact(); }}
      style={({ pressed }) => ({ position: 'absolute', left: Math.max(12, insets.left), right: Math.max(12, insets.right), bottom: insets.bottom + 4, minHeight: 44, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: pressed ? '#075985' : '#0F172AD9' })}>
      <Text style={s.text} numberOfLines={1}>{visible ? '▾ Player controls' : '▴ Show controls'} · {stream.name}</Text>
    </Pressable>}
  </View>;
}

function sameTrack(selected, track) {
  if (!selected) return false;
  return track.id != null ? selected.id === track.id : selected.language === track.language && selected.label === track.label && selected.name === track.name;
}


