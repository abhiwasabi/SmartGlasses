import type { Schema, Tool } from '@google/genai'

const captureTools: NonNullable<Tool['functionDeclarations']> = [
  { name: 'start_recording', description: 'Start video recording when the user says “start recording”.' },
  { name: 'stop_recording', description: 'Stop and save the current video recording when the user explicitly asks to stop.' },
]

const noteTools: NonNullable<Tool['functionDeclarations']> = [
  { name: 'start_note', description: 'Start capturing a spoken note, lecture, or class when the user asks to make a note or take notes.' },
  { name: 'save_note', description: 'Summarize and save the current note when the user says save note or finish note. Return a concise title and useful organized plain-text content, preserving names, numbers, and important details.' , parameters: {
    type: 'OBJECT' as Schema['type'],
    properties: {
      title: { type: 'STRING' as Schema['type'], description: 'A short, descriptive title for the note.' },
      content: { type: 'STRING' as Schema['type'], description: 'A ready-to-read summary in plain text. Keep a short reminder to one concise bullet, preserving names, quantities, dates, and actions. For a lecture or long explanation, use a descriptive topic, short section headings, and bullets for key ideas, details, and examples. Use brief paragraphs instead when the source is personal or reads naturally as connected prose. Do not invent facts. Do not use Markdown markers.' },
    },
    required: ['title', 'content'],
  } },
  { name: 'cancel_note', description: 'Discard the current voice note when the user asks to cancel or discard it.' },
]

export const LIVE_TOOLS: Tool[] = [{ functionDeclarations: [...captureTools, ...noteTools] }]
export const DRIVE_MODE_TOOLS: Tool[] = [{ functionDeclarations: captureTools }]
