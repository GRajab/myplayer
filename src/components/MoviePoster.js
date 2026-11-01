import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Film } from 'lucide-react-native';
import { colors, s } from './ui';
export default function MoviePoster({ uri, title, style }) {
  return <Poster key={uri || 'missing'} uri={uri} title={title} style={style} />;
}
function Poster({ uri, title, style }) {
  const [failed, setFailed] = useState(false);
  return <View accessibilityRole="image" accessibilityLabel={uri && !failed ? `${title} poster` : 'Poster not provided'} style={[styles.poster, style]}>
    {uri && !failed ? <Image accessible={false} source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="contain" onError={() => setFailed(true)} /> : <View style={styles.placeholder}><Film size={40} color={colors.muted} /><Text style={[s.muted, { textAlign: 'center' }]}>{failed ? 'Poster unavailable' : 'Poster not provided'}</Text></View>}
  </View>;
}
const styles = StyleSheet.create({ poster: { width: '100%', aspectRatio: 2 / 3, backgroundColor: '#1E293B', borderRadius: 14, overflow: 'hidden' }, placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 12 } });
