import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { PlayerProvider, usePlayer } from './state/PlayerContext';
function Navigation() {
  const { ready } = usePlayer();
  if (!ready) return <View style={{ flex: 1, backgroundColor: '#0F172A', justifyContent: 'center' }}><ActivityIndicator color="#38BDF8" /></View>;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0F172A' } }}><Stack.Screen name="index" /><Stack.Screen name="settings" /><Stack.Screen name="content" /><Stack.Screen name="movie" /><Stack.Screen name="series" options={{ presentation: 'card' }} /><Stack.Screen name="player" options={{ orientation: 'landscape', gestureEnabled: false }} /></Stack>;
}
export default function App() { return <PlayerProvider><Navigation /></PlayerProvider>; }
