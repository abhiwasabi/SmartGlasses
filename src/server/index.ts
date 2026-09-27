import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { GoogleGenAI, Modality } from '@google/genai'
import { createAccountAuthorizer } from './auth.ts'
import { elevenLabsMiddleware } from './elevenLabs.ts'
import {
  DRIVE_MODE_INSTRUCTION,
  LIVE_INSTRUCTION,
  liveTokenMiddleware,
} from './geminiLive.ts'
import { DRIVE_MODE_TOOLS, LIVE_TOOLS } from '../lib/liveTools.ts'

const settings = {
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live',
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID,
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabasePublishableKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
}

const allowedOrigins = new Set(
  (process.env.FRONTEND_ORIGIN || 'https://clarity-smart-glasses.abhinav-vargheese.chatgpt.site')
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
)
allowedOrigins.add('http://127.0.0.1:5175')
allowedOrigins.add('http://localhost:5175')

const authorize = createAccountAuthorizer(settings)
const speech = elevenLabsMiddleware({
  apiKey: settings.elevenLabsApiKey,
  voiceId: settings.elevenLabsVoiceId,
  supabaseUrl: settings.supabaseUrl,
  supabasePublishableKey: settings.supabasePublishableKey,
}, fetch, authorize)
const token = liveTokenMiddleware(settings, async (config, mode) => {
  const ai = new GoogleGenAI({ apiKey: config.apiKey, httpOptions: { apiVersion: 'v1beta', timeout: 15_000 } })
  const generated = await ai.authTokens.create({ config: {
    uses: 1,
    expireTime: new Date(Date.now() + 15 * 60_000).toISOString(),
    newSessionExpireTime: new Date(Date.now() + 60_000).toISOString(),
    liveConnectConstraints: { model: config.model, config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: mode === 'drive' ? DRIVE_MODE_INSTRUCTION : LIVE_INSTRUCTION,
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      tools: mode === 'drive' ? DRIVE_MODE_TOOLS : LIVE_TOOLS,
    } },
  } })
  if (!generated.name) throw new Error('Missing session token')
  return generated.name
}, authorize)

export function createBackendServer() {
  return createServer((request, response) => {
    const origin = request.headers.origin?.replace(/\/$/, '')
    if (origin && allowedOrigins.has(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin)
      response.setHeader('Vary', 'Origin')
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Assistant-Mode')
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(origin && !allowedOrigins.has(origin) ? 403 : 204)
      response.end()
      return
    }
    if (request.url?.split('?')[0] === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      response.end(JSON.stringify({ ok: true }))
      return
    }
    speech(request, response, () => {
      token(request, response, () => {
        response.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        response.end(JSON.stringify({ error: 'Route not found.' }))
      })
    })
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 3000
  const server = createBackendServer()
  server.listen(port, '0.0.0.0', () => console.log(`Clarity backend listening on port ${port}`))
  const shutdown = () => server.close(() => process.exit(0))
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}
