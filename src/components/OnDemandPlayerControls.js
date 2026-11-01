import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ArrowLeft, Play, Pause, Volume2, VolumeX, Plus, Minus, Captions, AudioLines, X } from 'lucide-react-native';
import { IconButton } from './IconButton';
import { Button, colors, s } from './ui';
import { clampPlaybackPosition, formatPlaybackTime, positionFromTouch } from '../utils/playerControls';

export default function OnDemandPlayerControls({ backLabel, progressLabel, visible, opacity, insets, height, title, paused, onTogglePlay, volume, onVolume, timeline, onSeek, seekable, onBack, onInteract, onTouching, failed, error, onRetry, audio, subtitles, audioTrack, subtitleTrack, onAudio, onSubtitle, trackMenu, onTrackMenu }) {
  const narrow = useWindowDimensions().width < 420;
  const interaction = { onTouchStart: () => { onTouching(true); onInteract(); }, onTouchEnd: () => { onTouching(false); onInteract(); }, onTouchCancel: () => { onTouching(false); onInteract(); }, onFocus: onInteract };
  const visibility = { pointerEvents: visible ? 'auto' : 'none', accessibilityElementsHidden: !visible, importantForAccessibility: visible ? 'auto' : 'no-hide-descendants' };
  const press = action => () => { onInteract(); action(); };
  const tracks = trackMenu === 'audio' ? audio : subtitles;
  const chosen = trackMenu === 'audio' ? audioTrack : subtitleTrack;
  return <>
    <Animated.View {...visibility} {...interaction} style={[styles.top, { top: Math.max(8, insets.top), left: Math.max(12, insets.left), right: Math.max(12, insets.right), opacity }]}>
      <IconButton label={backLabel} icon={ArrowLeft} onPress={onBack} /><Text style={[s.text, { flex: 1 }]} numberOfLines={1}>{title}</Text>
    </Animated.View>
    <Animated.View {...visibility} {...interaction} style={[styles.bottom, { bottom: Math.max(8, insets.bottom), left: Math.max(12, insets.left), right: Math.max(12, insets.right), opacity }]}>
      {!!trackMenu && <View style={[styles.tracks, { maxHeight: height * 0.4 }]}>
        <View style={styles.row}><Text style={[s.text, { flex: 1 }]}>{trackMenu === 'audio' ? 'Audio' : 'Subtitles'}</Text><IconButton label="Close track menu" icon={X} onPress={press(() => onTrackMenu(null))} /></View>
        <ScrollView keyboardShouldPersistTaps="handled" onScrollBeginDrag={onInteract} onScrollEndDrag={onInteract}>
          {trackMenu === 'subtitles' && <Track title="Off" selected={!subtitleTrack} onPress={press(() => { onSubtitle(null); onTrackMenu(null); })} />}
          {tracks.map((track, index) => <Track key={track.id ?? index} title={track.label || track.language || `Track ${index + 1}`} selected={sameTrack(chosen, track)} onPress={press(() => { if (trackMenu === 'audio') onAudio(track); else onSubtitle(track); onTrackMenu(null); })} />)}
          {!tracks.length && <Text style={[s.muted, { padding: 12 }]}>None available</Text>}
        </ScrollView>
      </View>}
      {failed && <View style={styles.error}><Text accessibilityRole="alert" style={[s.error, { flex: 1 }]}>{error}</Text><Button title="Retry" onPress={onRetry} /></View>}
      <Timeline label={progressLabel} position={timeline.position} duration={timeline.duration} buffered={timeline.buffered} enabled={seekable} onSeek={onSeek} onInteract={onInteract} onTouching={onTouching} />
      <View style={[styles.row, { flexWrap: 'wrap' }, narrow && { gap: 0 }]}>
        <IconButton label={paused ? 'Play' : 'Pause'} icon={paused ? Play : Pause} onPress={press(onTogglePlay)} />
        <IconButton label={volume ? 'Mute' : 'Unmute'} icon={volume ? Volume2 : VolumeX} onPress={press(() => onVolume(volume ? 0 : 1))} />
        <IconButton label="Decrease volume" icon={Minus} onPress={press(() => onVolume(Math.max(0, volume - 0.1)))} />
        {!narrow && <Text accessibilityLabel={`Volume ${Math.round(volume * 100)} percent`} style={s.muted}>{Math.round(volume * 100)}%</Text>}
        <IconButton label="Increase volume" icon={Plus} onPress={press(() => onVolume(Math.min(1, volume + 0.1)))} />
        <View style={{ flex: 1 }} />
        <IconButton label="Audio tracks" icon={AudioLines} selected={trackMenu === 'audio'} onPress={press(() => onTrackMenu(trackMenu === 'audio' ? null : 'audio'))} />
        <IconButton label="Subtitle tracks" icon={Captions} selected={!!subtitleTrack || trackMenu === 'subtitles'} onPress={press(() => onTrackMenu(trackMenu === 'subtitles' ? null : 'subtitles'))} />
      </View>
    </Animated.View>
  </>;
}
function Timeline({ label, position, duration, buffered, enabled, onSeek, onInteract, onTouching }) {
  const [preview, setPreview] = useState(null);
  const geometry = useRef({ left: 0, width: 0 });
  const drag = useRef(null);
  const latest = useRef({ duration, enabled, onSeek, onInteract, onTouching });
  useEffect(() => { latest.current = { duration, enabled, onSeek, onInteract, onTouching }; }, [duration, enabled, onSeek, onInteract, onTouching]);

  const grant = useCallback(event => {
    geometry.current.left = event.nativeEvent.pageX - event.nativeEvent.locationX;
    const value = positionFromTouch(event.nativeEvent.locationX, geometry.current.width, latest.current.duration);
    drag.current = value; setPreview(value);
    latest.current.onTouching(true); latest.current.onInteract();
  }, []);
  const move = useCallback((_, gesture) => {
    const value = positionFromTouch(gesture.moveX - geometry.current.left, geometry.current.width, latest.current.duration);
    drag.current = value; setPreview(value); latest.current.onInteract();
  }, []);
  const finish = useCallback(() => {
    if (drag.current !== null) latest.current.onSeek(drag.current);
    drag.current = null; setPreview(null); latest.current.onTouching(false); latest.current.onInteract();
  }, []);
  const cancel = useCallback(() => {
    drag.current = null; setPreview(null); latest.current.onTouching(false); latest.current.onInteract();
  }, []);
  // PanResponder stores these callbacks; refs are accessed only when touch events run.
  /* eslint-disable react-hooks/refs */
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => enabled,
    onMoveShouldSetPanResponder: () => enabled,
    onPanResponderGrant: grant,
    onPanResponderMove: move,
    onPanResponderRelease: finish,
    onPanResponderTerminate: cancel,
    onPanResponderTerminationRequest: () => false,
  }), [enabled, grant, move, finish, cancel]);
  /* eslint-enable react-hooks/refs */
  const current = preview ?? position;
  const ratio = duration > 0 ? Math.max(0, Math.min(1, current / duration)) : 0;
  const bufferedRatio = duration > 0 ? Math.max(ratio, Math.min(1, (buffered || 0) / duration)) : 0;
  function accessibleSeek(direction) {
    const value = clampPlaybackPosition(position + direction * 10, duration);
    if (enabled && value !== null) { onSeek(value); onInteract(); }
  }
  return <View>
    <View {...responder.panHandlers} onLayout={event => { geometry.current.width = event.nativeEvent.layout.width; }} accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityState={{ disabled: !enabled }} accessibilityValue={{ min: 0, max: duration > 0 ? Math.round(duration) : 0, now: Math.round(Math.min(Math.max(0, current), duration > 0 ? duration : 0)), text: `${formatPlaybackTime(current)} elapsed${duration > 0 ? ' of ' + formatPlaybackTime(duration) : ', duration unavailable'}` }} accessibilityActions={[{ name: 'increment', label: 'Forward 10 seconds' }, { name: 'decrement', label: 'Back 10 seconds' }]} onAccessibilityAction={event => accessibleSeek(event.nativeEvent.actionName === 'increment' ? 1 : -1)} style={styles.seekTouch}>
      <View pointerEvents="none" style={styles.track}>
        <View style={[styles.buffered, { width: `${bufferedRatio * 100}%` }]} />
        <View style={[styles.played, { width: `${ratio * 100}%` }]} />
        {duration > 0 && <View style={[styles.thumb, { left: `${ratio * 100}%` }]} />}
      </View>
    </View>
    <View pointerEvents="none" style={styles.times}><Text style={styles.time}>{formatPlaybackTime(current)}</Text><Text style={styles.time}>{duration > 0 ? formatPlaybackTime(duration) : '--:--'}</Text></View>
  </View>;
}
function Track({ title, selected, onPress }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.trackOption, selected && { backgroundColor: '#075985' }]}><Text style={s.text}>{selected ? '✓ ' : ''}{title}</Text></Pressable>;
}
function sameTrack(selected, track) { return !!selected && (track.id != null ? selected.id === track.id : selected.language === track.language && selected.label === track.label && selected.name === track.name); }
const styles = StyleSheet.create({
  top: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, backgroundColor: '#00000099', paddingRight: 12 },
  bottom: { position: 'absolute', borderRadius: 12, backgroundColor: '#0F172AEF', paddingHorizontal: 12, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seekTouch: { minHeight: 44, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: '#475569' },
  buffered: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: '#94A3B8' },
  played: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: colors.accent },
  thumb: { position: 'absolute', width: 12, height: 12, marginLeft: -6, top: -4, borderRadius: 6, backgroundColor: colors.accent },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -8, paddingBottom: 4 },
  time: { color: '#CBD5E1', fontSize: 12, fontVariant: ['tabular-nums'] },
  tracks: { width: '100%', maxWidth: 360, alignSelf: 'flex-end', borderBottomWidth: 1, borderColor: '#334155', padding: 8 },
  trackOption: { padding: 12, minHeight: 44, borderRadius: 8 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8 },
});


