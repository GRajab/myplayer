import { Pressable } from 'react-native';
import { colors } from './ui';
export function IconButton({ label, icon: Icon, onPress, selected = false, disabled = false }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, opacity: disabled ? 0.35 : pressed ? 0.6 : 1, backgroundColor: selected ? '#075985' : 'transparent' })}><Icon size={21} color={selected ? colors.accent : colors.text} /></Pressable>;
}
