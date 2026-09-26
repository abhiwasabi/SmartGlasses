export type AssistMode = 'scene' | 'question' | 'transcribe';
export type AssistRequest = {
  mode: AssistMode;
  goal?: string;
  question?: string;
  imageBase64?: string;
  audioBase64?: string;
};
export type AssistResponse = { message: string; shouldAlert?: boolean };

export function normalizedServerUrl(value: string) {
  const url = value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[\w.:-]+$/i.test(url)) throw new Error('Enter a laptop URL such as http://192.168.1.20:8766');
  return url;
}

export async function checkServer(serverUrl: string): Promise<{ geminiConfigured: boolean; model: string }> {
  const response = await fetch(`${normalizedServerUrl(serverUrl)}/health`);
  if (!response.ok) throw new Error('Could not reach the laptop service.');
  return response.json();
}

export async function assist(serverUrl: string, accessCode: string, input: AssistRequest): Promise<AssistResponse> {
  if (!accessCode.trim()) throw new Error('Add your mobile access code in Settings.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${normalizedServerUrl(serverUrl)}/api/assist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Mobile-Access-Code': accessCode.trim() },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The assistant could not respond.');
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('The assistant timed out. Try again.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
