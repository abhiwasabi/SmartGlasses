import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { esp32CameraProxy } from './src/server/cameraProxy'

export default defineConfig({
  plugins: [react(), esp32CameraProxy()],
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
})
