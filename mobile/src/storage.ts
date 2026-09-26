import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export type Note = { id: string; text: string; createdAt: string };
export type Memory = { id: string; kind: 'photo' | 'video'; uri: string; createdAt: string };
export type Settings = { serverUrl: string; accessCode: string; goal: string; autoScan: boolean; speakAlerts: boolean };

const SETTINGS_KEY = 'smartglasses.settings.v1';
const CODE_KEY = 'smartglasses.mobileAccessCode.v1';
const NOTES_KEY = 'smartglasses.notes.v1';
const MEMORIES_KEY = 'smartglasses.memories.v1';

export const defaults: Settings = { serverUrl: '', accessCode: '', goal: 'Help me understand what is around me', autoScan: false, speakAlerts: true };

export async function loadSettings(): Promise<Settings> {
  const [raw, accessCode] = await Promise.all([AsyncStorage.getItem(SETTINGS_KEY), SecureStore.getItemAsync(CODE_KEY)]);
  return { ...defaults, ...(raw ? JSON.parse(raw) : {}), accessCode: accessCode || '' };
}

export async function saveSettings(settings: Settings) {
  const { accessCode, ...publicSettings } = settings;
  await Promise.all([AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(publicSettings)), SecureStore.setItemAsync(CODE_KEY, accessCode)]);
}

export async function loadNotes(): Promise<Note[]> {
  const raw = await AsyncStorage.getItem(NOTES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveNotes(notes: Note[]) {
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

export async function loadMemories(): Promise<Memory[]> {
  const raw = await AsyncStorage.getItem(MEMORIES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveMemories(memories: Memory[]) {
  await AsyncStorage.setItem(MEMORIES_KEY, JSON.stringify(memories));
}
