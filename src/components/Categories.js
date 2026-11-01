import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, FlatList, PanResponder, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { GripVertical, Heart, Eye, EyeOff, RotateCcw, SlidersHorizontal, Pin } from 'lucide-react-native';
import { colors, s } from './ui';
import { IconButton } from './IconButton';
import { moveCategory, categoryDropTarget, dragScrollOffset } from '../utils/categories';

const ROW_HEIGHT = 64;
export const FAVORITES_CATEGORY = 'system:favorites';
export const ALL_CATEGORY = 'system:all';
export const providerKey = name => `provider:${name}`;

function CategorySearch({ value, onChange, editable = true }) {
  return <TextInput accessibilityLabel="Search categories" placeholder="Search" placeholderTextColor={colors.muted} style={[s.input, { padding: 8, minHeight: 44, fontSize: 14 }]} value={value} onChangeText={onChange} editable={editable} />;
}

export function CategoryPanel({ groups, preferences, selected, onSelect, onOrganise, favoriteCount, totalCount, onShowHidden, itemLabel = 'channels', pinnedCategories = [] }) {
  const [query, setQuery] = useState('');
  const rows = groups.filter(item => (preferences.showHidden || !preferences.hidden.includes(item.name)) && item.name.toLowerCase().includes(query.toLowerCase()));
  const choice = (id, label, count, hidden = false) => <Pressable accessibilityRole="button" accessibilityState={{ selected: selected === id }} accessibilityLabel={`${label}, ${count} ${itemLabel}${hidden ? ', hidden category' : ''}`} onPress={() => onSelect(id)} style={[styles.choice, selected === id && styles.selected]}>
    <Text numberOfLines={2} style={[s.text, { fontSize: 14 }, selected === id && { color: colors.accent }]}>{label}</Text><Text style={s.muted}>{count.toLocaleString()}{hidden ? ' · ◌' : ''}</Text>
  </Pressable>;
  const entries = [{ controls: true }, ...rows];
  return <View style={{ flex: 1, padding: 6 }}>
    <FlatList data={entries} keyExtractor={item => item.controls ? 'system:controls' : providerKey(item.name)} keyboardShouldPersistTaps="handled" stickyHeaderIndices={[0]}
      ListHeaderComponent={<View style={{ backgroundColor: colors.bg, paddingBottom: 10 }}>{choice(FAVORITES_CATEGORY, 'Favorites', favoriteCount)}{pinnedCategories.map(item => <View key={item.id}>{choice(item.id, item.name, item.count)}</View>)}</View>}
      contentContainerStyle={{ paddingBottom: 24 }} renderItem={({ item }) => item.controls ? <View style={{ gap: 10, paddingBottom: 10 }}>
        <View style={styles.toggle}><IconButton label="Organise categories" icon={SlidersHorizontal} onPress={onOrganise} /><IconButton label="Show hidden categories" icon={preferences.showHidden ? Eye : EyeOff} selected={preferences.showHidden} onPress={() => onShowHidden(!preferences.showHidden)} /></View>
        {choice(ALL_CATEGORY, 'All', totalCount)}
        <CategorySearch value={query} onChange={setQuery} />
        {!rows.length && <Text style={s.muted}>No matching categories.</Text>}
      </View> : <View style={{ paddingBottom: 6 }}>{choice(providerKey(item.name), item.name, item.count, preferences.hidden.includes(item.name))}</View>} />
  </View>;

}

function DragGrip({ name, onStart, onMove, onEnd, onCancel, onNudge }) {
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event => onStart(name, event.nativeEvent.pageY),
    onPanResponderMove: (_, gesture) => onMove(gesture.moveY),
    onPanResponderRelease: () => onEnd(),
    onPanResponderTerminate: () => onCancel(),
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  }), [name, onStart, onMove, onEnd, onCancel]);
  return <View {...responder.panHandlers} accessible accessibilityLabel={`Reorder ${name}`} accessibilityActions={[{ name: 'increment', label: 'Move down' }, { name: 'decrement', label: 'Move up' }]} onAccessibilityAction={event => onNudge(event.nativeEvent.actionName === 'increment' ? 1 : -1)} style={styles.grip}><GripVertical color={colors.muted} size={24} /></View>;
}

export function CategoryOrganiser({ groups, preferences, onOrder, onToggleHidden, onShowHidden, onReset }) {
  const [query, setQuery] = useState('');
  const [dragging, setDragging] = useState(null);
  const [marker, setMarker] = useState(null);
  const list = useRef(null);
  const viewport = useRef(null);
  const drag = useRef(null);
  const geometry = useRef({ top: 0, height: 0, offset: 0 });
  const rows = useMemo(() => groups.filter(item => (preferences.showHidden || !preferences.hidden.includes(item.name)) && item.name.toLowerCase().includes(query.toLowerCase())), [groups, preferences, query]);
  const latest = useRef({ rows, groups, onOrder });
  useEffect(() => { latest.current = { rows, groups, onOrder }; }, [rows, groups, onOrder]);

  const locate = useCallback(() => {
    if (!drag.current) return;
    const { top, offset } = geometry.current;
    const next = categoryDropTarget(latest.current.rows, drag.current.y, top, offset, ROW_HEIGHT);
    if (!next) return;
    drag.current.target = next;
    setMarker(old => old?.name === next.name && old?.after === next.after ? old : next);
  }, []);
  const start = useCallback((name, y) => {
    drag.current = { name, y, target: { name, after: false } };
    setDragging(name);
    viewport.current?.measureInWindow((_, top, __, height) => {
      geometry.current = { ...geometry.current, top, height };
      locate();
    });
    AccessibilityInfo.announceForAccessibility(`Moving ${name}. Drag to a new position.`);
  }, [locate]);
  const move = useCallback(y => {
    if (!drag.current) return;
    drag.current.y = y;
    locate();
  }, [locate]);
  const cancel = useCallback(() => {
    drag.current = null; setDragging(null); setMarker(null);
  }, []);
  const end = useCallback(() => {
    const current = drag.current;
    if (current?.target) {
      const order = latest.current.groups.map(item => item.name);
      const next = moveCategory(order, current.name, current.target.name, current.target.after);
      latest.current.onOrder(next);
      AccessibilityInfo.announceForAccessibility(`${current.name} moved to position ${next.indexOf(current.name) + 1}.`);
    }
    cancel();
  }, [cancel]);
  useEffect(() => {
    if (!dragging) return;
    const timer = setInterval(() => {
      if (!drag.current) return;
      const bounds = geometry.current;
      if (!bounds.height) return;
      const local = drag.current.y - bounds.top;
      const offset = dragScrollOffset(local, bounds.height, bounds.offset, latest.current.rows.length, ROW_HEIGHT);
      if (offset !== bounds.offset) {
        geometry.current.offset = offset;
        list.current?.scrollToOffset({ offset, animated: false });
        locate();
      }
    }, 50);
    return () => clearInterval(timer);
  }, [dragging, locate]);
  useEffect(() => () => { drag.current = null; }, []);

  function nudge(name, direction) {
    const order = groups.map(item => item.name);
    const index = rows.findIndex(item => item.name === name);
    const next = moveCategory(order, name, rows[index + direction]?.name, direction > 0);
    onOrder(next);
    AccessibilityInfo.announceForAccessibility(`${name} moved to position ${next.indexOf(name) + 1}.`);
  }
  return <View style={{ flex: 1, gap: 10 }}>
    <View style={styles.toggle}><Heart color={colors.accent} size={18} /><Text style={s.text}>Favorites</Text><Pin color={colors.muted} size={16} /></View>
    <View style={styles.toggle}><View style={{ flex: 1 }}><CategorySearch value={query} onChange={setQuery} editable={!dragging} /></View><IconButton label="Show hidden categories" icon={preferences.showHidden ? Eye : EyeOff} selected={preferences.showHidden} disabled={!!dragging} onPress={() => onShowHidden(!preferences.showHidden)} /><IconButton label="Reset category order" icon={RotateCcw} disabled={!!dragging} onPress={onReset} /></View>
    <View ref={viewport} collapsable={false} style={{ flex: 1, minHeight: 44 }}>
      <FlatList ref={list} removeClippedSubviews={false} data={rows} keyExtractor={item => item.name} keyboardShouldPersistTaps="handled" scrollEnabled={!dragging}
        onScroll={event => { geometry.current.offset = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}
        getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
        extraData={{ dragging, marker }}
        ListEmptyComponent={<Text style={s.muted}>No categories.</Text>}
        renderItem={({ item }) => {
          const hidden = preferences.hidden.includes(item.name);
          return <View style={[styles.organiseRow, dragging === item.name && styles.dragging]}>
            {marker?.name === item.name && <View pointerEvents="none" style={[styles.insertion, marker.after ? { bottom: 0 } : { top: 0 }]}><View style={styles.insertionDot} /></View>}
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <DragGrip name={item.name} onStart={start} onMove={move} onEnd={end} onCancel={cancel} onNudge={direction => nudge(item.name, direction)} />
              <View style={{ flex: 1 }}><Text numberOfLines={1} style={s.text}>{item.name}</Text><Text style={s.muted}>{item.count}</Text></View><IconButton label={`${hidden ? 'Restore' : 'Hide'} ${item.name}`} icon={hidden ? EyeOff : Eye} disabled={!!dragging} onPress={() => onToggleHidden(item.name)} />
            </View>
          </View>;
        }} />
      {!!dragging && <View pointerEvents="none" style={styles.dragLabel}><Text style={s.text} numberOfLines={1}>{dragging}</Text></View>}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  choice: { padding: 8, minHeight: 56, gap: 4, borderRadius: 10, backgroundColor: colors.panel },
  selected: { borderWidth: 1, borderColor: colors.accent, backgroundColor: '#075985' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pinned: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  organiseRow: { height: ROW_HEIGHT, padding: 6, borderBottomWidth: 1, borderBottomColor: '#334155', backgroundColor: colors.panel },
  grip: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  action: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#075985', borderRadius: 8 },
  dragging: { backgroundColor: '#164E63', opacity: 0.7 },
  insertion: { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: colors.accent, zIndex: 10 },
  insertionDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent, position: 'absolute', left: 0, top: -3 },
  dragLabel: { position: 'absolute', top: 0, alignSelf: 'center', padding: 8, backgroundColor: '#075985', borderRadius: 8 },
});

