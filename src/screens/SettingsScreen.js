import { useState } from 'react';
import { ScrollView, Text, TextInput, View, ActivityIndicator } from 'react-native';
import { Pencil, Play, Plus, Star, X, ArrowLeft, Check } from 'lucide-react-native';
import { router } from 'expo-router';
import { usePlayer } from '../state/PlayerContext';
import { validUrl } from '../services/playlist';
import { Page, Button, Header, s, colors } from '../components/ui';
import { IconButton } from '../components/IconButton';
export default function SettingsScreen() {
  const { playlists, activePlaylistId, defaultPlaylistId, configure, activatePlaylist, setDefaultPlaylist, storageError, playlistError } = usePlayer();
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(!playlists.length);
  const [name, setName] = useState('');
  const [type, setType] = useState('m3u');
  const [url, setUrl] = useState('');
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function edit(entry) {
    setEditing(entry?.id || null); setFormOpen(true); setError('');
    setName(entry?.name || ''); setType(entry?.config.type || 'm3u');
    setUrl(entry?.config.url || ''); setServer(entry?.config.server || '');
    setUsername(entry?.config.username || ''); setPassword(entry?.config.password || '');
  }
  async function save() {
    setBusy(true); setError('');
    try {
      if (!name.trim()) throw new Error('Enter a playlist name.');
      if (type === 'xtream' && (!username.trim() || !password)) throw new Error('Enter username and password.');
      const config = type === 'm3u' ? { type, url: validUrl(url) } : { type, server: validUrl(server).replace(/\/+$/, ''), username: username.trim(), password };
      await configure(config, { id: editing, name });
      setFormOpen(false);
      router.replace('/');
    } catch (e) { setError(e.message || 'Unable to load playlist.'); }
    finally { setBusy(false); }
  }
  async function open(id) { setBusy(true); try { await activatePlaylist(id); router.replace('/'); } finally { setBusy(false); } }
  const input = (label, value, setter, secret = false) => <TextInput accessibilityLabel={label} style={s.input} value={value} onChangeText={setter} secureTextEntry={secret} autoCapitalize="none" autoCorrect={false} editable={!busy} placeholder={label} placeholderTextColor={colors.muted} />;
  return <Page><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
    <Header title="Playlists"><View style={s.row}><IconButton label="Add playlist" icon={Plus} disabled={busy} onPress={() => edit(null)} /><IconButton label="Back" icon={ArrowLeft} disabled={busy} onPress={() => router.replace('/')} /></View></Header>
    {!!storageError && <Text accessibilityRole="alert" style={s.error}>{storageError}</Text>}
    {!!playlistError && <Text style={s.muted}>{playlistError}</Text>}
    {playlists.map(entry => <View key={entry.id} style={[s.card, { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 4 }]}>
      <View style={{ flex: 1, paddingRight: 4 }}><Text style={s.heading} numberOfLines={2}>{entry.name}</Text><Text style={s.muted}>{entry.items.length.toLocaleString()}{entry.id === activePlaylistId ? ' · Active' : ''}{entry.id === defaultPlaylistId ? ' · Default' : ''}</Text></View>
      <IconButton label={`Make ${entry.name} default`} icon={Star} selected={entry.id === defaultPlaylistId} disabled={busy} onPress={() => setDefaultPlaylist(entry.id)} />
      <IconButton label={`Edit ${entry.name}`} icon={Pencil} disabled={busy} onPress={() => edit(entry)} />
      <IconButton label={`Load ${entry.name}`} icon={Play} disabled={busy} onPress={() => open(entry.id)} />
    </View>)}
    {formOpen && <View style={{ gap: 12 }}>
      <View style={[s.row, { justifyContent: 'space-between' }]}><Text style={s.heading}>{editing ? 'Edit playlist' : 'New playlist'}</Text>{!!playlists.length && <IconButton label="Cancel" icon={X} disabled={busy} onPress={() => setFormOpen(false)} />}</View>
      {input('Name', name, setName)}
      <View style={s.row}><Button title={type === 'm3u' ? '✓ M3U' : 'M3U'} disabled={busy} onPress={() => setType('m3u')} /><Button title={type === 'xtream' ? '✓ Xtream' : 'Xtream'} disabled={busy} onPress={() => setType('xtream')} /></View>
      {type === 'm3u' ? input('M3U URL', url, setUrl) : <>{input('Server URL', server, setServer)}{input('Username', username, setUsername)}{input('Password', password, setPassword, true)}</>}
      <Text style={s.muted}>Saved on this device · Unencrypted</Text>
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      <Button title="Save & load" disabled={busy} onPress={save}><View style={s.row}><Check color={colors.text} size={20} /><Text style={s.text}>Save</Text></View></Button>
    </View>}
    {busy && <ActivityIndicator color={colors.accent} />}
  </ScrollView></Page>;
}
