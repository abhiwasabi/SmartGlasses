import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppServer } from './server.mjs';

async function withServer(generate, callback) {
  const server = createAppServer({ accessCode: 'sample-test-code', apiKey: 'fake-key', generate });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('health and access code protect assistant', async () => {
  await withServer(async () => ({ text: 'hello' }), async url => {
    const health = await (await fetch(`${url}/health`)).json();
    assert.equal(health.ok, true);
    const denied = await fetch(`${url}/api/assist`, { method: 'POST', body: '{}' });
    assert.equal(denied.status, 401);
  });
});

test('scene prompt uses the goal and image; returns structured alert', async () => {
  let request;
  await withServer(async input => { request = input; return { text: '{"shouldAlert":true,"message":"Trash bin on your right."}' }; }, async url => {
    const response = await fetch(`${url}/api/assist`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mobile-Access-Code': 'sample-test-code' }, body: JSON.stringify({ mode: 'scene', goal: 'find a trash bin', imageBase64: 'YWJj' }) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { shouldAlert: true, message: 'Trash bin on your right.' });
  });
  assert.match(request.contents[0].parts[0].text, /find a trash bin/);
  assert.equal(request.contents[0].parts[1].inlineData.mimeType, 'image/jpeg');
});

test('invalid requests are rejected before Gemini call', async () => {
  let calls = 0;
  await withServer(async () => { calls++; return { text: '' }; }, async url => {
    const response = await fetch(`${url}/api/assist`, { method: 'POST', headers: { 'X-Mobile-Access-Code': 'sample-test-code' }, body: JSON.stringify({ mode: 'transcribe' }) });
    assert.equal(response.status, 400);
  });
  assert.equal(calls, 0);
});

test('spoken question sends audio as an inline Gemini part', async () => {
  let request;
  await withServer(async input => { request = input; return { text: 'The answer is near the camera.' }; }, async url => {
    const response = await fetch(`${url}/api/assist`, { method: 'POST', headers: { 'X-Mobile-Access-Code': 'sample-test-code' }, body: JSON.stringify({ mode: 'question', audioBase64: 'YWJj' }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).message, 'The answer is near the camera.');
  });
  assert.equal(request.contents[0].parts[1].inlineData.mimeType, 'audio/mp4');
});
