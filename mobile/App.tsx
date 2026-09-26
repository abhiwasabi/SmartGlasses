import { useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Speech from 'expo-speech';
import * as Sharing from 'expo-sharing';
import { useVideoPlayer, VideoView } from 'expo-video';
import Constants from 'expo-constants';
import { assist, checkServer } from './src/api';
import { defaults, loadMemories, loadNotes, loadSettings, Memory, Note, saveMemories, saveNotes, saveSettings, Settings } from './src/storage';

type Tab = 'Assist' | 'Notes' | 'Memories' | 'Settings';
const nav: { name: Tab; icon: keyof typeof Ionicons.glyphMap }[] = [
  { name: 'Assist', icon: 'scan-outline' }, { name: 'Notes', icon: 'document-text-outline' },
  { name: 'Memories', icon: 'albums-outline' }, { name: 'Settings', icon: 'options-outline' },
];
const c = { bg: '#0B1016', card: '#151E27', card2: '#1C2934', text: '#EDF5F3', muted: '#95A8AD', accent: '#B5F271', line: '#2B3941' };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Please try again.';

function Button({ label, icon, onPress, alt, disabled }: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void; alt?: boolean; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[s.button, alt && s.buttonAlt, disabled && { opacity: 0.45 }]}>
    {icon && <Ionicons name={icon} size={17} color={alt ? c.text : c.bg} />}<Text style={[s.buttonText, alt && { color: c.text }]}>{label}</Text>
  </Pressable>;
}
function Card({ children }: { children: React.ReactNode }) { return <View style={s.card}>{children}</View>; }
function VideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return <VideoView player={player} style={s.viewer} nativeControls contentFit="contain" />;
}

function MobileApp() {
  const [tab, setTab] = useState<Tab>('Assist');
  const [settings, setSettings] = useState<Settings>(defaults);
  const [notes, setNotes] = useState<Note[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [scene, setScene] = useState('Point the camera at your surroundings, then scan.');
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState('Not checked');
  const [cameraReady, setCameraReady] = useState(false);
  const [mode, setMode] = useState<'picture' | 'video'>('picture');
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [recordingVideo, setRecordingVideo] = useState(false);
  const [recordingVoice, setRecordingVoice] = useState<'question' | 'note' | null>(null);
  const [selected, setSelected] = useState<Memory | null>(null);
  const camera = useRef<CameraView>(null);
  const scanBusy = useRef(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [cameraPermission, askCamera] = useCameraPermissions();
  const [micPermission, askMic] = useMicrophonePermissions();

  useEffect(() => { Promise.all([loadSettings(), loadNotes(), loadMemories()]).then(([a, b, d]) => {
    setSettings(a); setNotes(b); setMemories(d);
  }).catch(error => Alert.alert('Storage', errorMessage(error))); }, []);
  const change = (patch: Partial<Settings>) => setSettings(current => ({ ...current, ...patch }));
  const report = (error: unknown) => Alert.alert('SmartGlasses', errorMessage(error));
  const persist = async () => { try { await saveSettings(settings); Alert.alert('Saved', 'Settings saved on this phone.'); } catch (error) { report(error); } };

  const frame = async () => {
    if (!cameraReady || mode !== 'picture' || !camera.current) throw new Error('Switch to Photo mode and wait for the camera.');
    const photo = await camera.current.takePictureAsync({ quality: 0.5 });
    if (!photo?.uri) throw new Error('Could not capture a frame.');
    const image = await manipulateAsync(photo.uri, [{ resize: { width: 640 } }], { compress: 0.55, format: SaveFormat.JPEG, base64: true });
    if (!image.base64) throw new Error('Could not prepare the frame.');
    return image.base64;
  };
  const scan = async () => {
    if (scanBusy.current) return;
    if (!settings.serverUrl || !settings.accessCode) { setScene('Add your laptop URL and access code in Settings.'); return; }
    scanBusy.current = true; setBusy(true);
    try {
      const result = await assist(settings.serverUrl, settings.accessCode, { mode: 'scene', goal: settings.goal, imageBase64: await frame() });
      setScene(result.shouldAlert ? result.message : 'Nothing relevant to your goal needs attention right now.');
      if (result.shouldAlert && result.message && settings.speakAlerts) Speech.speak(result.message);
    } catch (error) { setScene(errorMessage(error)); }
    finally { scanBusy.current = false; setBusy(false); }
  };
  useEffect(() => {
    if (tab !== 'Assist' || !settings.autoScan || mode !== 'picture' || !cameraReady) return;
    const timer = setInterval(() => { scan().catch(report); }, 7000);
    return () => clearInterval(timer);
  }, [tab, settings, mode, cameraReady]);
  const ask = async (audioBase64?: string) => {
    if (!question.trim() && !audioBase64) return;
    setBusy(true);
    try {
      const imageBase64 = cameraReady && mode === 'picture' ? await frame() : undefined;
      const result = await assist(settings.serverUrl, settings.accessCode, { mode: 'question', goal: settings.goal, question: question.trim(), imageBase64, audioBase64 });
      setAnswer(result.message || 'No answer returned.'); setQuestion('');
      if (result.message && settings.speakAlerts) Speech.speak(result.message);
    } catch (error) { report(error); }
    finally { setBusy(false); }
  };
  const addNote = async (text: string) => {
    if (!text.trim()) return;
    const next = [{ id: String(Date.now()), text: text.trim(), createdAt: new Date().toISOString() }, ...notes];
    await saveNotes(next); setNotes(next); setNoteDraft('');
  };
  const voice = async (purpose: 'question' | 'note') => {
    try {
      if (recordingVoice) {
        const previous = recordingVoice;
        await recorder.stop(); setRecordingVoice(null);
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        if (!recorder.uri) throw new Error('Recording was empty.');
        const audioBase64 = await FileSystem.readAsStringAsync(recorder.uri, { encoding: FileSystem.EncodingType.Base64 });
        if (previous === 'question') await ask(audioBase64);
        else {
          setBusy(true);
          try {
            const result = await assist(settings.serverUrl, settings.accessCode, { mode: 'transcribe', audioBase64 });
            if (result.message) await addNote(result.message);
            else Alert.alert('No speech found', 'Try recording again.');
          } finally { setBusy(false); }
        }
      } else {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) throw new Error('Allow microphone access to record.');
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync(); recorder.record(); setRecordingVoice(purpose);
      }
    } catch (error) { setRecordingVoice(null); report(error); }
  };
  const saveMemory = async (uri: string, kind: 'photo' | 'video') => {
    if (!FileSystem.documentDirectory) throw new Error('Phone storage is unavailable.');
    const id = String(Date.now());
    const sourceExtension = uri.split('?')[0].split('.').pop()?.toLowerCase();
    const extension = kind === 'photo' ? 'jpg' : sourceExtension === 'mov' ? 'mov' : 'mp4';
    const destination = `${FileSystem.documentDirectory}memory-${id}.${extension}`;
    await FileSystem.copyAsync({ from: uri, to: destination });
    const next: Memory[] = [{ id, kind, uri: destination, createdAt: new Date().toISOString() }, ...memories];
    await saveMemories(next); setMemories(next);
  };
  const photoMemory = async () => {
    try {
      if (!cameraReady || !camera.current) throw new Error('Camera is not ready.');
      const photo = await camera.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) throw new Error('Photo capture failed.');
      await saveMemory(photo.uri, 'photo'); Alert.alert('Saved', 'Photo added to Memories.');
    } catch (error) { report(error); }
  };
  const videoMemory = async () => {
    if (recordingVideo) { camera.current?.stopRecording(); return; }
    try {
      const permission = micPermission?.granted ? micPermission : await askMic();
      if (!permission.granted) throw new Error('Allow microphone access to record video.');
      if (!cameraReady || mode !== 'video' || !camera.current) throw new Error('Wait for the video camera to become ready.');
      setRecordingVideo(true);
      const video = await camera.current.recordAsync({ maxDuration: 30 });
      if (video?.uri) { await saveMemory(video.uri, 'video'); Alert.alert('Saved', 'Video added to Memories.'); }
    } catch (error) { report(error); }
    finally { setRecordingVideo(false); }
  };
  const share = async (item: Memory) => { try { if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(item.uri); } catch (error) { report(error); } };
  const check = async () => { setConnection('Checking…'); try { const health = await checkServer(settings.serverUrl); setConnection(health.geminiConfigured ? `Connected · ${health.model}` : 'Connected · Gemini key missing'); } catch (error) { setConnection(errorMessage(error)); } };
  const suggestedHost = Constants.expoConfig?.hostUri?.split(':')[0];

  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
    <StatusBar barStyle="light-content" backgroundColor={c.bg} />
    <View style={s.header}><View><Text style={s.eyebrow}>SMARTGLASSES / MOBILE</Text><Text style={s.title}>{tab}</Text></View><View style={s.logo}><Ionicons name="sparkles" size={21} color={c.bg} /></View></View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {tab === 'Assist' && <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.goal}><Ionicons name="navigate-outline" size={18} color={c.accent} /><Text style={s.goalText}>{settings.goal}</Text></View>
        <View style={s.camera}>
          {cameraPermission?.granted ? <CameraView key={`${mode}-${facing}`} ref={camera} style={StyleSheet.absoluteFill} facing={facing} mode={mode} mute={false} onCameraReady={() => setCameraReady(true)} onMountError={event => setScene(event.message)} />
            : <View style={s.cameraEmpty}><Ionicons name="camera-outline" size={42} color={c.muted} /><Text style={s.muted}>Camera access is needed to understand the scene.</Text><Button label="Allow camera" onPress={() => { askCamera().catch(report); }} /></View>}
          <View style={s.cameraTop}><Text style={s.badge}>{recordingVideo ? '● RECORDING' : mode === 'picture' ? 'LIVE VIEW' : 'VIDEO MODE'}</Text><Pressable style={s.flip} onPress={() => { setCameraReady(false); setFacing(facing === 'back' ? 'front' : 'back'); }}><Ionicons name="camera-reverse-outline" size={20} color={c.text} /></Pressable></View>
        </View>
        <View style={s.row}><Button label="Photo + AI" onPress={() => { if (!recordingVideo && mode !== 'picture') { setCameraReady(false); setMode('picture'); } }} alt={mode !== 'picture'} /><Button label="Video memory" onPress={() => { if (!recordingVideo && mode !== 'video') { setCameraReady(false); setMode('video'); } }} alt={mode !== 'video'} /></View>
        {mode === 'picture' ? <View style={s.row}><Button label={busy ? 'Thinking…' : 'Scan scene'} icon="scan-outline" onPress={() => { scan().catch(report); }} disabled={busy || !cameraReady} /><Button label="Save photo" icon="camera-outline" alt onPress={() => { photoMemory().catch(report); }} disabled={!cameraReady} /></View>
          : <Button label={recordingVideo ? 'Stop recording' : 'Record up to 30 seconds'} icon={recordingVideo ? 'stop-circle-outline' : 'radio-button-on-outline'} onPress={() => { videoMemory().catch(report); }} disabled={!cameraReady && !recordingVideo} />}
        <Card><Text style={s.label}>SCENE SIGNAL</Text><Text style={s.body}>{scene}</Text><Text style={s.hint}>Alerts are based on visible camera details. Keep your attention on the real world.</Text></Card>
        <Card><Text style={s.label}>ASK ABOUT WHAT YOU SEE</Text><TextInput style={[s.input, { minHeight: 66 }]} value={question} onChangeText={setQuestion} placeholder="What is in front of me?" placeholderTextColor={c.muted} multiline />
          <View style={s.row}><Button label={busy ? 'Thinking…' : 'Ask Gemini'} icon="arrow-up-outline" onPress={() => { ask().catch(report); }} disabled={busy || !question.trim()} /><Button label={recordingVoice === 'question' ? 'Finish' : 'Speak'} icon={recordingVoice === 'question' ? 'stop-outline' : 'mic-outline'} alt onPress={() => { voice('question').catch(report); }} disabled={busy || (recordingVoice !== null && recordingVoice !== 'question')} /></View>
          {!!answer && <View style={s.answer}><Text style={s.body}>{answer}</Text><Pressable onPress={() => Speech.stop()}><Text style={s.link}>Stop voice</Text></Pressable></View>}</Card>
      </ScrollView>}
      {tab === 'Notes' && <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"><Text style={s.intro}>Capture an idea quickly. Dictated notes are transcribed by Gemini and saved on this phone.</Text>
        <Card><Text style={s.label}>NEW NOTE</Text><TextInput style={[s.input, { minHeight: 95 }]} value={noteDraft} onChangeText={setNoteDraft} placeholder="What should you remember?" placeholderTextColor={c.muted} multiline />
          <View style={s.row}><Button label="Save note" icon="checkmark-outline" onPress={() => { addNote(noteDraft).catch(report); }} disabled={!noteDraft.trim()} /><Button label={recordingVoice === 'note' ? 'Finish' : 'Dictate'} icon={recordingVoice === 'note' ? 'stop-outline' : 'mic-outline'} alt onPress={() => { voice('note').catch(report); }} disabled={busy || (recordingVoice !== null && recordingVoice !== 'note')} /></View></Card>
        <Text style={s.section}>Your notes · {notes.length}</Text>{notes.length === 0 ? <Text style={s.muted}>No notes yet.</Text> : notes.map(note => <Card key={note.id}><View style={s.between}><Text style={s.muted}>{new Date(note.createdAt).toLocaleString()}</Text><Pressable onPress={() => Alert.alert('Delete note?', 'This removes the note from this phone.', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { const next = notes.filter(item => item.id !== note.id); saveNotes(next).then(() => setNotes(next)).catch(report); } }])}><Ionicons name="trash-outline" size={18} color={c.muted} /></Pressable></View><Text style={s.body}>{note.text}</Text></Card>)}
      </ScrollView>}
      {tab === 'Memories' && <ScrollView contentContainerStyle={s.scroll}><Text style={s.intro}>Photos and short videos stay in this app’s local storage. Share one when you choose.</Text>
        {selected ? <><Pressable onPress={() => setSelected(null)} style={s.row}><Ionicons name="arrow-back" size={18} color={c.accent} /><Text style={s.link}>All memories</Text></Pressable>{selected.kind === 'photo' ? <Image source={{ uri: selected.uri }} style={s.viewer} resizeMode="contain" /> : <VideoPlayer uri={selected.uri} />}<Text style={s.muted}>{new Date(selected.createdAt).toLocaleString()}</Text><Button label="Share memory" icon="share-outline" onPress={() => { share(selected).catch(report); }} /></>
          : memories.length === 0 ? <Card><Ionicons name="albums-outline" size={34} color={c.accent} /><Text style={s.body}>No memories yet. Take a photo or record a video on Assist.</Text></Card>
            : memories.map(item => <Pressable key={item.id} onPress={() => setSelected(item)} style={s.memory}>{item.kind === 'photo' ? <Image source={{ uri: item.uri }} style={s.thumb} /> : <View style={[s.thumb, s.videoThumb]}><Ionicons name="videocam-outline" size={26} color={c.accent} /></View>}<View style={{ flex: 1 }}><Text style={s.body}>{item.kind === 'photo' ? 'Photo memory' : 'Video memory'}</Text><Text style={s.muted}>{new Date(item.createdAt).toLocaleString()}</Text></View><Ionicons name="chevron-forward" size={19} color={c.muted} /></Pressable>)}
      </ScrollView>}
      {tab === 'Settings' && <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"><Text style={s.intro}>Connect to the companion service on your laptop. Keep your phone and laptop on the same Wi-Fi.</Text>
        <Card><Text style={s.label}>LAPTOP CONNECTION</Text><Text style={s.field}>Service URL</Text><TextInput style={s.input} value={settings.serverUrl} onChangeText={serverUrl => change({ serverUrl })} placeholder="http://192.168.1.20:8766" placeholderTextColor={c.muted} autoCapitalize="none" keyboardType="url" />
          {!!suggestedHost && <Pressable onPress={() => change({ serverUrl: `http://${suggestedHost}:8766` })}><Text style={s.link}>Use Expo host: {suggestedHost}</Text></Pressable>}
          <Text style={s.field}>Mobile access code</Text><TextInput style={s.input} value={settings.accessCode} onChangeText={accessCode => change({ accessCode })} placeholder="Code from mobile/.env.local" placeholderTextColor={c.muted} secureTextEntry autoCapitalize="none" />
          <View style={s.row}><Button label="Save" icon="save-outline" onPress={() => { persist().catch(report); }} /><Button label="Test" icon="pulse-outline" alt onPress={() => { check().catch(report); }} /></View><Text style={s.hint}>{connection}</Text></Card>
        <Card><Text style={s.label}>ASSISTANT BEHAVIOR</Text><Text style={s.field}>What are you trying to do?</Text><TextInput style={[s.input, { minHeight: 78 }]} value={settings.goal} onChangeText={goal => change({ goal })} placeholder="e.g. Find a trash bin" placeholderTextColor={c.muted} multiline />
          <View style={s.between}><View><Text style={s.body}>Scan automatically</Text><Text style={s.hint}>Every 7 seconds on Assist</Text></View><Switch value={settings.autoScan} onValueChange={autoScan => change({ autoScan })} trackColor={{ true: c.accent }} /></View>
          <View style={s.between}><View><Text style={s.body}>Speak responses</Text><Text style={s.hint}>Uses this phone’s voice</Text></View><Switch value={settings.speakAlerts} onValueChange={speakAlerts => change({ speakAlerts })} trackColor={{ true: c.accent }} /></View><Button label="Save preferences" onPress={() => { persist().catch(report); }} /></Card>
        <Text style={s.hint}>The Gemini API key stays on your laptop. Camera frames and recorded questions are sent to that service when you request help.</Text>
      </ScrollView>}
    </KeyboardAvoidingView>
    <View style={s.nav}>{nav.map(item => <Pressable key={item.name} onPress={() => { if (!recordingVideo && !recordingVoice) { setTab(item.name); setSelected(null); setCameraReady(false); } }} style={s.navItem}><Ionicons name={item.icon} size={22} color={tab === item.name ? c.accent : c.muted} /><Text style={[s.navText, tab === item.name && { color: c.accent }]}>{item.name}</Text></Pressable>)}</View>
  </SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><MobileApp /></SafeAreaProvider>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg }, header: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, eyebrow: { color: c.accent, fontSize: 10, fontWeight: '800', letterSpacing: 2 }, title: { color: c.text, fontSize: 29, fontWeight: '800', marginTop: 3 }, logo: { width: 40, height: 40, borderRadius: 13, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 18, paddingBottom: 32, gap: 15 }, intro: { color: c.muted, fontSize: 15, lineHeight: 22, marginBottom: 6 }, section: { color: c.text, fontSize: 21, fontWeight: '800', marginTop: 8 }, muted: { color: c.muted, fontSize: 12 },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: c.card, borderRadius: 15, borderWidth: 1, borderColor: c.line, padding: 14 }, goalText: { color: c.text, flex: 1, fontSize: 14, fontWeight: '600' },
  camera: { height: 265, borderRadius: 22, overflow: 'hidden', backgroundColor: c.card2 }, cameraEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, padding: 20 }, cameraTop: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, badge: { color: c.text, backgroundColor: '#0B1016BB', overflow: 'hidden', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7, fontWeight: '800', letterSpacing: 1, fontSize: 10 }, flip: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#0B1016BB', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }, button: { minHeight: 44, borderRadius: 13, backgroundColor: c.accent, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, buttonAlt: { backgroundColor: c.card2, borderWidth: 1, borderColor: c.line }, buttonText: { color: c.bg, fontWeight: '800', fontSize: 13 },
  card: { borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, padding: 17, gap: 12 }, label: { color: c.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }, body: { color: c.text, fontSize: 15, lineHeight: 22 }, hint: { color: c.muted, fontSize: 12, lineHeight: 18 }, field: { color: c.text, fontSize: 13, fontWeight: '700', marginTop: 4 },
  input: { color: c.text, backgroundColor: c.bg, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, textAlignVertical: 'top' }, answer: { borderTopWidth: 1, borderColor: c.line, paddingTop: 13, gap: 9 }, link: { color: c.accent, fontSize: 13, fontWeight: '700' }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  memory: { flexDirection: 'row', gap: 13, alignItems: 'center', padding: 10, borderRadius: 17, backgroundColor: c.card, borderWidth: 1, borderColor: c.line }, thumb: { width: 68, height: 68, borderRadius: 11 }, videoThumb: { backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' }, viewer: { height: 360, width: '100%', backgroundColor: '#000', borderRadius: 17 },
  nav: { flexDirection: 'row', borderTopColor: c.line, borderTopWidth: 1, backgroundColor: c.bg, paddingTop: 10, paddingBottom: 4 }, navItem: { flex: 1, alignItems: 'center', gap: 4 }, navText: { color: c.muted, fontSize: 10, fontWeight: '700' },
});
