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
const nav: { name: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { name: 'Assist', label: 'Overview', icon: 'grid-outline' }, { name: 'Notes', label: 'Notes', icon: 'document-text-outline' },
  { name: 'Memories', label: 'Memories', icon: 'bookmark-outline' }, { name: 'Settings', label: 'Settings', icon: 'options-outline' },
];
// Match the desktop dashboard's neutral surfaces, black navigation and coral actions.
const c = { bg: '#FFFFFF', card: '#F7F7F7', card2: '#FFFFFF', text: '#151515', muted: '#858585', accent: '#DF6348', line: '#EAEAEA', black: '#111111', gray: '#EDEDED', blush: '#F8E9E4' };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Please try again.';

function Button({ label, icon, onPress, alt, dark, disabled }: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void; alt?: boolean; dark?: boolean; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[s.button, alt && s.buttonAlt, dark && s.buttonDark, disabled && { opacity: 0.45 }]}>
    {icon && <Ionicons name={icon} size={17} color={alt ? c.text : '#FFFFFF'} />}<Text style={[s.buttonText, alt && { color: c.text }]}>{label}</Text>
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
    <StatusBar barStyle="dark-content" backgroundColor={c.card} />
    <View style={s.header}>
      <View style={s.brandRow}><View style={s.logo}><Ionicons name="glasses-outline" size={22} color="#FFFFFF" /></View><Text style={s.brand}>clarity<Text style={s.brandDot}>.</Text></Text></View>
      <View style={s.headerCopy}><Text style={s.headerName}>SmartGlasses</Text><Text style={s.headerSubtitle}>{tab === 'Assist' ? 'Overview dashboard' : tab}</Text></View>
    </View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {tab === 'Assist' && <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Card>
          <View style={s.panelHeader}><View style={s.panelIcon}><Ionicons name="sparkles-outline" size={22} color={c.black} /></View><View style={{ flex: 1 }}><Text style={s.panelHeading}>Ask your glasses</Text><Text style={s.hint}>Talk with Gemini about what your camera sees.</Text></View></View>
          <TextInput style={[s.input, { minHeight: 64 }]} value={question} onChangeText={setQuestion} placeholder="What am I looking at?" placeholderTextColor={c.muted} multiline />
          <View style={s.row}><Button label={busy ? 'Thinking…' : 'Ask Gemini'} icon="arrow-up-outline" onPress={() => { ask().catch(report); }} disabled={busy || !question.trim()} /><Button label={recordingVoice === 'question' ? 'Finish speaking' : 'Speak instead'} icon={recordingVoice === 'question' ? 'stop-outline' : 'mic-outline'} dark onPress={() => { voice('question').catch(report); }} disabled={busy || (recordingVoice !== null && recordingVoice !== 'question')} /></View>
          {!!answer && <View style={s.answer}><Text style={s.body}>{answer}</Text><Pressable onPress={() => Speech.stop()}><Text style={s.link}>Stop voice</Text></Pressable></View>}
        </Card>
        <Card>
          <View style={s.panelHeader}><View style={s.panelIcon}><Ionicons name="mic-outline" size={24} color={c.black} /></View><View style={{ flex: 1 }}><Text style={s.label}>MADE FOR HANDS-FREE MOMENTS</Text><Text style={s.heroHeading}>Just say the word.</Text><Text style={s.hint}>Capture a thought or a moment without a keyboard.</Text></View></View>
          <View style={s.quickActions}><View style={s.quickAction}><Ionicons name="mic-outline" size={18} color={c.accent} /><Text style={s.quickActionText}>Ask by voice</Text></View><View style={s.quickAction}><Ionicons name="document-text-outline" size={18} color={c.accent} /><Text style={s.quickActionText}>Dictate a note</Text></View><View style={s.quickAction}><Ionicons name="videocam-outline" size={18} color={c.accent} /><Text style={s.quickActionText}>Save a moment</Text></View></View>
        </Card>
        <Card>
          <Text style={s.panelHeading}>What are you trying to do?</Text><Text style={s.hint}>Give the assistant a goal so it can judge what the camera notices.</Text>
          <Text style={s.field}>Your goal</Text><TextInput style={s.input} value={settings.goal} onChangeText={goal => change({ goal })} placeholder="Find a trash bin, locate a door…" placeholderTextColor={c.muted} multiline />
          <View style={s.row}><Button label="Set goal" onPress={() => { persist().catch(report); }} /><Button label={busy ? 'Scanning…' : 'Scan once'} icon="scan-outline" alt onPress={() => { scan().catch(report); }} disabled={busy || !cameraReady || mode !== 'picture'} /></View>
          <View style={s.statusLine}><View style={s.statusDot} /><Text style={s.hint}>{settings.autoScan ? 'Automatic scanning is on' : 'Local assistant ready · safety alerts remain active'}</Text></View>
          <Text style={s.body}>{scene}</Text>
        </Card>
        <Card>
          <View style={s.panelHeader}><View style={s.panelIcon}><Ionicons name="videocam-outline" size={22} color={c.black} /></View><View style={{ flex: 1 }}><Text style={s.panelHeading}>Your perspective</Text><Text style={s.hint}>A window into your everyday.</Text></View><Text style={s.hint}>{cameraReady ? 'Camera ready' : 'Camera offline'}</Text></View>
          <View style={s.sourcePill}><Ionicons name="camera-outline" size={15} color="#FFFFFF" /><Text style={s.sourceText}>This device</Text></View>
          <View style={s.camera}>
            {cameraPermission?.granted ? <CameraView key={`${mode}-${facing}`} ref={camera} style={StyleSheet.absoluteFill} facing={facing} mode={mode} mute={false} onCameraReady={() => setCameraReady(true)} onMountError={event => setScene(event.message)} />
              : <View style={s.cameraEmpty}><View style={s.panelIcon}><Ionicons name="glasses-outline" size={27} color={c.black} /></View><Text style={s.panelHeading}>Your camera view will appear here.</Text><Text style={s.hint}>Allow the camera to preview and capture your surroundings.</Text><Button label="Allow camera" icon="camera-outline" dark onPress={() => { askCamera().catch(report); }} /></View>}
            <View style={s.cameraTop}><Text style={s.badge}>{recordingVideo ? '● RECORDING' : mode === 'picture' ? 'LIVE VIEW' : 'VIDEO MODE'}</Text><Pressable style={s.flip} onPress={() => { setCameraReady(false); setFacing(facing === 'back' ? 'front' : 'back'); }}><Ionicons name="camera-reverse-outline" size={20} color={c.text} /></Pressable></View>
          </View>
          <View style={s.row}><Button label="Photo + AI" onPress={() => { if (!recordingVideo && mode !== 'picture') { setCameraReady(false); setMode('picture'); } }} dark={mode === 'picture'} alt={mode !== 'picture'} /><Button label="Video memory" onPress={() => { if (!recordingVideo && mode !== 'video') { setCameraReady(false); setMode('video'); } }} dark={mode === 'video'} alt={mode !== 'video'} /></View>
          {mode === 'picture' ? <View style={s.row}><Button label="Save photo" icon="camera-outline" alt onPress={() => { photoMemory().catch(report); }} disabled={!cameraReady} /><Button label={busy ? 'Scanning…' : 'Scan scene'} icon="scan-outline" onPress={() => { scan().catch(report); }} disabled={busy || !cameraReady} /></View>
            : <Button label={recordingVideo ? 'Stop recording' : 'Record up to 30 seconds'} icon={recordingVideo ? 'stop-circle-outline' : 'radio-button-on-outline'} onPress={() => { videoMemory().catch(report); }} disabled={!cameraReady && !recordingVideo} />}
        </Card>
        <Card><View style={s.panelHeader}><View style={s.panelIcon}><Ionicons name="document-text-outline" size={23} color={c.accent} /></View><View style={{ flex: 1 }}><Text style={s.panelHeading}>Voice notes</Text><Text style={s.hint}>Speak a thought. Keep it here.</Text></View></View><Button label="Dictate a note" icon="mic-outline" onPress={() => setTab('Notes')} /></Card>
        <Card><View style={s.panelHeader}><View style={s.panelIcon}><Ionicons name="bookmark-outline" size={23} color={c.accent} /></View><View style={{ flex: 1 }}><Text style={s.panelHeading}>Worth remembering · {memories.length}</Text><Text style={s.hint}>Small moments. A bigger picture.</Text></View></View><Button label="View all memories" icon="arrow-forward-outline" alt onPress={() => setTab('Memories')} /></Card>
      </ScrollView>}
      {tab === 'Notes' && <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"><Text style={s.section}>Voice notes</Text><Text style={s.intro}>Speak a thought. Keep it here. Dictated notes are transcribed by Gemini and saved on this phone.</Text>
        <Card><View style={s.panelHeader}><View style={s.panelIcon}><Ionicons name="document-text-outline" size={23} color={c.accent} /></View><View style={{ flex: 1 }}><Text style={s.panelHeading}>Your voice, put into words.</Text><Text style={s.hint}>Write it down or dictate a new note.</Text></View></View><TextInput style={[s.input, { minHeight: 95 }]} value={noteDraft} onChangeText={setNoteDraft} placeholder="What should you remember?" placeholderTextColor={c.muted} multiline />
          <View style={s.row}><Button label="Save note" icon="checkmark-outline" onPress={() => { addNote(noteDraft).catch(report); }} disabled={!noteDraft.trim()} /><Button label={recordingVoice === 'note' ? 'Finish' : 'Dictate'} icon={recordingVoice === 'note' ? 'stop-outline' : 'mic-outline'} alt onPress={() => { voice('note').catch(report); }} disabled={busy || (recordingVoice !== null && recordingVoice !== 'note')} /></View></Card>
        <Text style={s.section}>Your notes · {notes.length}</Text>{notes.length === 0 ? <Text style={s.muted}>No notes yet.</Text> : notes.map(note => <Card key={note.id}><View style={s.between}><Text style={s.muted}>{new Date(note.createdAt).toLocaleString()}</Text><Pressable onPress={() => Alert.alert('Delete note?', 'This removes the note from this phone.', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { const next = notes.filter(item => item.id !== note.id); saveNotes(next).then(() => setNotes(next)).catch(report); } }])}><Ionicons name="trash-outline" size={18} color={c.muted} /></Pressable></View><Text style={s.body}>{note.text}</Text></Card>)}
      </ScrollView>}
      {tab === 'Memories' && <ScrollView contentContainerStyle={s.scroll}><Text style={s.section}>Worth remembering · {memories.length}</Text><Text style={s.intro}>Small moments. A bigger picture. Photos and short videos stay on this phone.</Text>
        {selected ? <><Pressable onPress={() => setSelected(null)} style={s.row}><Ionicons name="arrow-back" size={18} color={c.accent} /><Text style={s.link}>All memories</Text></Pressable>{selected.kind === 'photo' ? <Image source={{ uri: selected.uri }} style={s.viewer} resizeMode="contain" /> : <VideoPlayer uri={selected.uri} />}<Text style={s.muted}>{new Date(selected.createdAt).toLocaleString()}</Text><Button label="Share memory" icon="share-outline" onPress={() => { share(selected).catch(report); }} /></>
          : memories.length === 0 ? <Card><View style={s.panelIcon}><Ionicons name="bookmark-outline" size={29} color={c.accent} /></View><Text style={s.panelHeading}>Your next memory starts here.</Text><Text style={s.body}>Take a photo or record a video on Overview.</Text><Button label="Open camera" onPress={() => setTab('Assist')} /></Card>
            : memories.map(item => <Pressable key={item.id} onPress={() => setSelected(item)} style={s.memory}>{item.kind === 'photo' ? <Image source={{ uri: item.uri }} style={s.thumb} /> : <View style={[s.thumb, s.videoThumb]}><Ionicons name="videocam-outline" size={26} color={c.accent} /></View>}<View style={{ flex: 1 }}><Text style={s.body}>{item.kind === 'photo' ? 'Photo memory' : 'Video memory'}</Text><Text style={s.muted}>{new Date(item.createdAt).toLocaleString()}</Text></View><Ionicons name="chevron-forward" size={19} color={c.muted} /></Pressable>)}
      </ScrollView>}
      {tab === 'Settings' && <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"><Text style={s.intro}>Connect to the companion service on your laptop. Keep your phone and laptop on the same Wi-Fi.</Text>
        <Card><Text style={s.label}>LAPTOP CONNECTION</Text><Text style={s.field}>Service URL</Text><TextInput style={s.input} value={settings.serverUrl} onChangeText={serverUrl => change({ serverUrl })} placeholder="http://192.168.1.20:8766" placeholderTextColor={c.muted} autoCapitalize="none" keyboardType="url" />
          {!!suggestedHost && <Pressable onPress={() => change({ serverUrl: `http://${suggestedHost}:8766` })}><Text style={s.link}>Use Expo host: {suggestedHost}</Text></Pressable>}
          <Text style={s.field}>Mobile access code</Text><TextInput style={s.input} value={settings.accessCode} onChangeText={accessCode => change({ accessCode })} placeholder="Code from mobile/server/.env.local" placeholderTextColor={c.muted} secureTextEntry autoCapitalize="none" />
          <View style={s.row}><Button label="Save" icon="save-outline" onPress={() => { persist().catch(report); }} /><Button label="Test" icon="pulse-outline" alt onPress={() => { check().catch(report); }} /></View><Text style={s.hint}>{connection}</Text></Card>
        <Card><Text style={s.label}>ASSISTANT BEHAVIOR</Text><Text style={s.field}>What are you trying to do?</Text><TextInput style={[s.input, { minHeight: 78 }]} value={settings.goal} onChangeText={goal => change({ goal })} placeholder="e.g. Find a trash bin" placeholderTextColor={c.muted} multiline />
          <View style={s.between}><View><Text style={s.body}>Scan automatically</Text><Text style={s.hint}>Every 7 seconds on Assist</Text></View><Switch value={settings.autoScan} onValueChange={autoScan => change({ autoScan })} trackColor={{ true: c.accent }} /></View>
          <View style={s.between}><View><Text style={s.body}>Speak responses</Text><Text style={s.hint}>Uses this phone’s voice</Text></View><Switch value={settings.speakAlerts} onValueChange={speakAlerts => change({ speakAlerts })} trackColor={{ true: c.accent }} /></View><Button label="Save preferences" onPress={() => { persist().catch(report); }} /></Card>
        <Text style={s.hint}>The Gemini API key stays on your laptop. Camera frames and recorded questions are sent to that service when you request help.</Text>
      </ScrollView>}
    </KeyboardAvoidingView>
    <View style={s.nav}>{nav.map(item => <Pressable key={item.name} onPress={() => { if (!recordingVideo && !recordingVoice) { setTab(item.name); setSelected(null); setCameraReady(false); } }} style={[s.navItem, tab === item.name && s.navActive]}><Ionicons name={item.icon} size={19} color={tab === item.name ? '#FFFFFF' : c.muted} /><Text style={[s.navText, tab === item.name && s.navTextActive]}>{item.label}</Text></Pressable>)}</View>
  </SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><MobileApp /></SafeAreaProvider>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: { minHeight: 84, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logo: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.black, alignItems: 'center', justifyContent: 'center' },
  brand: { color: c.black, fontSize: 24, fontWeight: '800', letterSpacing: -1.4 },
  brandDot: { color: c.accent },
  headerCopy: { flex: 1, alignItems: 'flex-end' },
  headerName: { color: c.black, fontSize: 14, fontWeight: '600' },
  headerSubtitle: { color: c.muted, fontSize: 11, marginTop: 2 },
  scroll: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 34, gap: 16 },
  intro: { color: c.muted, fontSize: 14, lineHeight: 21, marginBottom: 4 },
  section: { color: c.text, fontSize: 23, fontWeight: '500', letterSpacing: -0.7, marginTop: 5 },
  muted: { color: c.muted, fontSize: 12 },
  card: { borderRadius: 28, backgroundColor: c.card, padding: 20, gap: 14 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  panelIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  panelHeading: { color: c.text, fontSize: 18, fontWeight: '600', letterSpacing: -0.5 },
  heroHeading: { color: c.text, fontSize: 24, fontWeight: '500', letterSpacing: -0.8, marginVertical: 3 },
  label: { color: c.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1.3 },
  body: { color: c.text, fontSize: 14, lineHeight: 21 },
  hint: { color: c.muted, fontSize: 12, lineHeight: 18 },
  field: { color: c.text, fontSize: 12, fontWeight: '600', marginTop: 3 },
  row: { flexDirection: 'row', gap: 9, alignItems: 'center', flexWrap: 'wrap' },
  button: { minHeight: 44, borderRadius: 24, backgroundColor: c.accent, paddingHorizontal: 17, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  buttonAlt: { backgroundColor: c.card2, borderWidth: 1, borderColor: c.line },
  buttonDark: { backgroundColor: c.black },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 12 },
  input: { color: c.text, backgroundColor: c.card2, borderWidth: 1, borderColor: c.line, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, textAlignVertical: 'top' },
  answer: { backgroundColor: c.card2, borderRadius: 19, padding: 15, gap: 9 },
  link: { color: c.accent, fontSize: 13, fontWeight: '600' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  quickActions: { flexDirection: 'row', gap: 7 },
  quickAction: { flex: 1, minHeight: 71, backgroundColor: c.card2, borderRadius: 17, padding: 11, alignItems: 'flex-start', justifyContent: 'center', gap: 7 },
  quickActionText: { color: c.text, fontSize: 10, fontWeight: '500' },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#526B5B' },
  sourcePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.black, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8 },
  sourceText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  camera: { height: 255, borderRadius: 23, overflow: 'hidden', backgroundColor: c.gray },
  cameraEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 11, padding: 20 },
  cameraTop: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { color: '#555555', backgroundColor: '#FFFFFFE6', overflow: 'hidden', borderRadius: 18, paddingHorizontal: 10, paddingVertical: 7, fontWeight: '700', letterSpacing: 1, fontSize: 9 },
  flip: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFFE6', alignItems: 'center', justifyContent: 'center' },
  memory: { flexDirection: 'row', gap: 13, alignItems: 'center', padding: 11, borderRadius: 22, backgroundColor: c.card2, borderWidth: 1, borderColor: c.line },
  thumb: { width: 68, height: 68, borderRadius: 15 },
  videoThumb: { backgroundColor: c.blush, alignItems: 'center', justifyContent: 'center' },
  viewer: { height: 360, width: '100%', backgroundColor: '#000000', borderRadius: 22 },
  nav: { flexDirection: 'row', backgroundColor: c.card, marginHorizontal: 12, marginBottom: 6, borderRadius: 25, padding: 6, gap: 3 },
  navItem: { flex: 1, minHeight: 54, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navActive: { backgroundColor: c.black },
  navText: { color: c.muted, fontSize: 9, fontWeight: '600' },
  navTextActive: { color: '#FFFFFF' },
});
