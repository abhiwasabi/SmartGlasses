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

const claimTools: NonNullable<Tool['functionDeclarations']> = [
  {
    name: 'create_claim_packet',
    description: 'Create an organized State Farm auto insurance incident claim packet when the user is in an accident, car crash, collision, or reports vehicle damage.',
    parameters: {
      type: 'OBJECT' as Schema['type'],
      properties: {
        title: { type: 'STRING' as Schema['type'], description: 'Title of the claim report, e.g. "State Farm Auto Claim · Collision on 8th St"' },
        otherParty: { type: 'STRING' as Schema['type'], description: 'Other driver name, phone, or insurance company & policy # if seen on card or spoken' },
        licensePlate: { type: 'STRING' as Schema['type'], description: 'Other vehicle license plate number, state, and vehicle make/model if visible' },
        damageSummary: { type: 'STRING' as Schema['type'], description: 'Observed damage on all vehicles from camera or voice description' },
        location: { type: 'STRING' as Schema['type'], description: 'Location, street, intersection, or campus lot where incident happened' },
        narrative: { type: 'STRING' as Schema['type'], description: 'Objective, factual summary of what happened without assuming or assigning fault' },
      },
      required: ['title', 'damageSummary', 'narrative'],
    },
  },
]

export const LIVE_TOOLS: Tool[] = [{ functionDeclarations: [...captureTools, ...noteTools, ...claimTools] }]
export const DRIVE_MODE_TOOLS: Tool[] = [{ functionDeclarations: [...captureTools, ...claimTools] }]

