import http from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

const MAX_FRAME_BYTES = 8 * 1024 * 1024
const CAPTURE_TIMEOUT_MS = 5_000

function captureTarget(value: string | null): URL {
  if (!value) throw new Error('Enter the camera base URL, for example http://192.168.1.120.')

  let target: URL
  try {
    target = new URL(value)
  } catch {
    throw new Error('The camera URL must be a complete http:// or https:// address.')
  }

  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
    throw new Error('Use an HTTP or HTTPS camera URL without a username or password.')
  }

  // Restrict this development proxy to literal LAN addresses. Avoid resolving
  // arbitrary hostnames, which could change to a public address between requests.
  if (target.hostname === 'localhost') target.hostname = '127.0.0.1'
  const octets = target.hostname.split('.').map(Number)
  const localAddress = isIP(target.hostname) === 4 && (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
  )
  if (!localAddress) {
    throw new Error('Use the camera’s private IPv4 address (10.x.x.x, 172.16–31.x.x, or 192.168.x.x), or localhost.')
  }

  target.pathname = `${target.pathname.replace(/\/+$/, '')}/capture`
  target.search = ''
  target.hash = ''
  return target
}

function sendError(response: ServerResponse, status: number, code: string, error: string) {
  if (response.destroyed || response.writableEnded) return
  if (response.headersSent) {
    response.destroy()
    return
  }
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify({ code, error }))
}

function cameraProxy(request: IncomingMessage, response: ServerResponse, next: () => void) {
  const incoming = new URL(request.url ?? '/', 'http://localhost')
  if (incoming.pathname !== '/api/camera/capture') {
    next()
    return
  }

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    sendError(response, 405, 'METHOD_NOT_ALLOWED', 'Camera capture only supports GET requests.')
    return
  }

  let target: URL
  try {
    target = captureTarget(incoming.searchParams.get('url'))
  } catch (error) {
    sendError(response, 400, 'INVALID_CAMERA_URL', (error as Error).message)
    return
  }

  let upstreamResponse: IncomingMessage | undefined
  let settled = false
  const cleanup = () => {
    clearTimeout(timeout)
    request.off('aborted', onDisconnect)
    response.off('close', onClose)
  }
  const fail = (status: number, code: string, message: string) => {
    if (settled) return
    settled = true
    cleanup()
    upstreamResponse?.destroy()
    upstreamRequest.destroy()
    sendError(response, status, code, message)
  }
  const onDisconnect = () => {
    if (settled) return
    settled = true
    cleanup()
    upstreamResponse?.destroy()
    upstreamRequest.destroy()
  }
  const onClose = () => {
    if (!response.writableFinished) onDisconnect()
  }

  const transport = target.protocol === 'https:' ? https : http
  const upstreamRequest = transport.get(target, {
    headers: { Accept: 'image/jpeg', 'Cache-Control': 'no-cache' },
    // Each capture closes its connection; ESP32 firmware has limited sockets.
    agent: false,
  }, (upstream) => {
    upstreamResponse = upstream
    const status = upstream.statusCode ?? 502
    if (status !== 200) {
      const clientStatus = status >= 400 && status <= 599 ? status : 502
      const message = status === 404
        ? 'The camera has no /capture endpoint. Use ESP32 CameraWebServer firmware and its base URL.'
        : `The camera returned HTTP ${status}. Check its base URL and CameraWebServer firmware.`
      fail(clientStatus, 'CAMERA_HTTP_ERROR', message)
      return
    }

    const contentType = upstream.headers['content-type']?.split(';')[0].trim().toLowerCase()
    if (contentType !== 'image/jpeg' && contentType !== 'image/jpg') {
      fail(502, 'UNSUPPORTED_CAMERA_RESPONSE', 'The camera did not return a JPEG image. Its /capture endpoint must support JPEG snapshots.')
      return
    }
    if (Number(upstream.headers['content-length']) > MAX_FRAME_BYTES) {
      fail(502, 'FRAME_TOO_LARGE', 'The camera frame exceeds the 8 MiB limit. Lower the camera resolution.')
      return
    }

    response.statusCode = 200
    response.setHeader('Content-Type', 'image/jpeg')
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')

    let bytesReceived = 0
    upstream.on('data', (chunk: Buffer) => {
      bytesReceived += chunk.length
      if (bytesReceived > MAX_FRAME_BYTES) {
        fail(502, 'FRAME_TOO_LARGE', 'The camera frame exceeds the 8 MiB limit. Lower the camera resolution.')
      } else if (!settled && !response.write(chunk)) {
        upstream.pause()
      }
    })
    response.on('drain', () => upstream.resume())
    upstream.on('end', () => {
      if (settled) return
      if (bytesReceived === 0) {
        fail(502, 'EMPTY_CAMERA_FRAME', 'The camera returned an empty JPEG image. Try capturing again.')
        return
      }
      settled = true
      cleanup()
      response.end()
    })
    upstream.on('error', () => fail(502, 'CAMERA_CONNECTION_FAILED', 'The camera connection ended before its image finished downloading.'))
  })

  const timeout = setTimeout(() => {
    fail(504, 'CAMERA_TIMEOUT', 'The camera did not respond within 5 seconds. Check its IP address and Wi-Fi connection.')
  }, CAPTURE_TIMEOUT_MS)
  upstreamRequest.on('error', () => {
    fail(502, 'CAMERA_CONNECTION_FAILED', 'Could not connect to the camera. Check its IP address and connect this computer to the same Wi-Fi network.')
  })
  request.on('aborted', onDisconnect)
  response.on('close', onClose)
}

/** Snapshot proxy for standard ESP32 CameraWebServer firmware in local Vite. */
export function esp32CameraProxy(): Plugin {
  return {
    name: 'esp32-camera-proxy',
    configureServer(server) {
      server.middlewares.use(cameraProxy)
    },
    configurePreviewServer(server) {
      server.middlewares.use(cameraProxy)
    },
  }
}
