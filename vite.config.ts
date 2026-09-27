import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { geminiLivePlugin } from './src/server/geminiLive'
import { esp32CameraProxy } from './src/server/cameraProxy'

export default defineConfig({
  plugins: [react(), esp32CameraProxy(), geminiLivePlugin()],
  server: {
    host: '127.0.0.1',
    allowedHosts: true,
  },
  preview: { host: '127.0.0.1' },
})
