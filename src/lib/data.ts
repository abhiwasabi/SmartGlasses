export interface Note {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
  tag: string;
  sample?: boolean;
}

export interface Memory {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  category: 'Everyday' | 'Work' | 'Adventure';
  kind: 'event' | 'recording';
  image?: string;
  duration?: number;
  mimeType?: string;
  size?: number;
  playbackStart?: number;
  mediaDuration?: number;
  sample?: boolean;
}

export const initialNotes: Note[] = [];

export const initialMemories: Memory[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isOptionalNonnegativeNumber(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === 'boolean';
}

export function validateNotes(value: unknown): value is Note[] {
  return Array.isArray(value) && value.every((note: unknown) =>
    isRecord(note)
    && typeof note.id === 'string'
    && typeof note.title === 'string'
    && typeof note.body === 'string'
    && isDateString(note.updatedAt)
    && typeof note.tag === 'string'
    && isOptionalBoolean(note.sample),
  );
}

export function validateMemories(value: unknown): value is Memory[] {
  return Array.isArray(value) && value.every((memory: unknown) =>
    isRecord(memory)
    && typeof memory.id === 'string'
    && typeof memory.title === 'string'
    && typeof memory.description === 'string'
    && isDateString(memory.createdAt)
    && (memory.category === 'Everyday' || memory.category === 'Work' || memory.category === 'Adventure')
    && (memory.kind === 'event' || memory.kind === 'recording')
    && isOptionalString(memory.image)
    && isOptionalNonnegativeNumber(memory.duration)
    && isOptionalString(memory.mimeType)
    && isOptionalNonnegativeNumber(memory.size)
    && isOptionalNonnegativeNumber(memory.playbackStart)
    && isOptionalNonnegativeNumber(memory.mediaDuration)
    && isOptionalBoolean(memory.sample),
  );
}

export function formatDuration(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = String(total % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${remainder}`
    : `${String(minutes).padStart(2, '0')}:${remainder}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const normalizedIndex = Math.max(0, index);
  const amount = bytes / 1024 ** normalizedIndex;
  return `${amount.toFixed(normalizedIndex === 0 || amount >= 10 ? 0 : 1)} ${units[normalizedIndex]}`;
}
