const environment = (import.meta as { env?: Record<string, string | undefined> }).env
const configuredBase = environment?.VITE_API_BASE_URL?.trim().replace(/\/$/, '') ?? ''

export function apiUrl(path: string) {
  return `${configuredBase}${path}`
}
