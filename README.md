# Clarity · SmartGlasses dashboard

A React and TypeScript dashboard for the [SmartGlasses project](https://github.com/abhiwasabi/SmartGlasses). Capture camera footage and dictate notes through hands-free voice commands. Review saved content in the dashboard.

## Features

- Camera preview and recording, with a choice of two configured ESP32-CAM devices or the phone/computer camera.
- Recording playback and download, with saved recordings included in the memory library.
- Voice-dictated notes saved as you speak, with manual editing for corrections.
- A microphone status panel, live transcript, command guide, and optional acknowledgement tones.
- Voice-triggered 30-second memory clips. The top memory search bar has been removed.
- Events and memories organized by Everyday, Work, and Adventure.
- Settings for the two ESP32-CAM addresses.
- An empty workspace that contains only notes, recordings, and events you create.

## Run locally

Install Node.js 22.6 or newer and npm, then run these commands from the repository folder:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://127.0.0.1:5173/`). Do not open `index.html` directly; the React entry point needs Vite. To compile the app and preview the production build locally:

```bash
npm run build
npm run preview
```

The build writes the frontend to `dist/`. Camera access requires browser permission; use the local URL for webcam testing.

## iPhone demo

The phone layout includes bottom navigation, safe-area spacing for the notch and home indicator, touch controls, and text inputs sized to avoid Safari keyboard zoom. Open the dashboard in Safari and keep the page in the foreground while capturing. Choose **This device** to use the iPhone camera; it prefers the rear camera on initial connection. Safari uses the iPhone's default microphone for voice recognition.

The iPhone must open an **HTTPS URL with a trusted certificate**. `127.0.0.1` on the phone refers to the phone, not the computer running Vite. An ordinary `http://<computer-LAN-IP>:5174` URL may display the layout but does not enable secure camera/microphone APIs. For ESP32 capture, the HTTPS origin must forward `/api/camera/capture` to the dashboard server running on the camera network; static frontend hosting alone is insufficient. This repository does not publish or configure that HTTPS endpoint automatically.

Notes and videos on the computer do not appear automatically on the phone: storage is per browser and origin. Test permission prompts, speech recognition, recording, playback, and downloading on the physical iPhone before the final demo. Desktop phone-size testing does not verify iOS media services.

## Hands-free voice controls

Choose a camera and configure its address once. Under voice controls, select an input from **Microphone**, then click **Enable voice** and allow access. The dropdown updates automatically when microphones are connected or disconnected. Before microphone permission is granted, the browser may hide device names or additional inputs; enabling voice refreshes the list after permission is granted. Pause voice before changing the input. The selection is remembered on this browser. Specific microphone routing uses desktop Chromium 135 or newer; other browsers use **System default**. Unplugged selected inputs produce an error instead of switching to a different microphone. Keep the dashboard open. Speak English commands:

| Say | Result |
| --- | --- |
| “Record this message” / “Start recording” | Connects the selected camera if necessary, then starts recording. |
| “Stop recording” | Stops and saves the recording to Memories. |
| “Clip a memory” / “Clip this” | Records the next 30 seconds and saves automatically. |
| “Make a new note” followed by your words | Starts dictation; finalized words are saved to the same note as you speak. |
| “Save note” | Finishes the current note and returns to command listening. |
| “Cancel note” | Discards the note being dictated. |
| “Stop listening” | Saves finalized note text, if any, and pauses the microphone. |

You can say a complete note in one utterance: “Make a new note remember to charge the glasses save note.” Finish phrases are excluded from saved content. During dictation, recording phrases are treated as note content; finish the note before issuing another recording command. Pausing microphone access preserves finalized text, but unfinished recognition text is not committed.

A clip captures **forward from the command**, not the previous 30 seconds. Clips never create content from footage that was not recorded. Only one camera can record at a time. Existing longer recordings are not interrupted by another clip command.

The frontend uses the [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) with the selected microphone (or system default). This does not add an audio transport to the ESP32 camera firmware. A dedicated glasses microphone needs to be exposed as a browser audio input or integrated with a speech-to-text backend.

Speech recognition is not supported by every browser or embedded preview. Chrome is a practical option; the app shows an explicit error when recognition or its service is unavailable. Some browsers send audio to their speech service and need internet access. This app has no custom transcription backend or API key requirement. Microphone listening does not start automatically on page load; a user gesture and permission are required, and a spoken “stop listening” command cannot re-enable a paused microphone. The initial enable step is manual.

## Connect two ESP32-CAM devices

The dashboard assumes each board is already running firmware compatible with Espressif's standard [CameraWebServer example](https://github.com/espressif/arduino-esp32/tree/master/libraries/ESP32/examples/Camera/CameraWebServer), with a JPEG image available at its `/capture` endpoint. Firmware setup and wiring are outside this frontend project.

1. Connect both camera boards and the computer running Vite to the same Wi-Fi network.
2. Find each board's LAN IP address and confirm that its camera server is reachable from that computer.
3. Open **Settings** in the dashboard and enter the separate base URLs for the two cameras, such as `http://192.168.1.100` and `http://192.168.1.101`. Include `http://` and omit `/capture` or `/stream`.
4. Choose a camera in the recording view, connect it, and start recording.

The local Vite server provides `/api/camera/capture`, a same-origin proxy that fetches JPEG images from the selected camera. This avoids browser CORS restrictions. The frontend polls for frames with a target of roughly 10 frames per second; actual performance depends on the board, image size, and network. ESP32-CAM recordings through this path contain video only.

You can switch between the two configured cameras, but recording uses **one selected camera at a time**. Simultaneous dual-camera recording is not implemented. The **This device** camera is an alternative source and can include microphone audio when browser permission is granted.

USB-to-RS232 or USB-UART adapters belong to the flashing and serial-communication workflow, subject to the board's requirements. A connected serial adapter is not assumed to expose an ESP32-CAM as a USB webcam; the dashboard obtains ESP32-CAM video over Wi-Fi.

No physical ESP32-CAM devices were tested during development of this interface. Confirm endpoint compatibility and recording behavior with your boards.

## Verification

```bash
npm run build
npm test
```

The proxy tests use local mock camera servers to check URL validation, successful capture, response limits, disconnect cleanup, and timeouts. Voice tests cover command parsing, dictation boundaries, duplicate final results, permission errors, and microphone cleanup. Physical hardware and speech-service availability still need verification on your network.

## Storage

Notes, event details, and dashboard settings use `localStorage`. Recording video files use IndexedDB. Saved notes and video files stay in the current browser profile and are not synchronized between devices. Browser speech recognition may send microphone audio to its recognition service; it is not guaranteed to work offline.

The dashboard starts empty and shows only user-created notes, recordings, and events. Records still marked as samples from an earlier version are removed automatically; your own content is preserved.

Clearing site data removes saved content, and browser storage limits can prevent new recordings from being saved. Download recordings you want to keep.

## Deployment

`npm run preview` includes the camera proxy for local use. A production deployment needs a backend that implements the same `/api/camera/capture` route and can reach the camera network. Serving only the static contents of `dist/` does **not** provide ESP32-CAM capture. A public server also cannot reach private LAN camera addresses without suitable network access.

## Project structure

```text
src/
  main.tsx           React entry point
  App.tsx            Dashboard views and interactions
  hooks/             Browser state and camera hooks
  lib/               Shared data types, storage, and helpers
  server/            Local ESP32-CAM snapshot proxy
public/
  favicon.svg        App icon
vite.config.ts       Vite configuration and local camera proxy
```


## Gemini Live visual assistant

The dashboard can stream microphone audio and the selected camera to Gemini Live,
then play spoken replies and show input/output captions. The server mints a
single-session ephemeral token; the permanent Gemini key never reaches React.
The token route runs with both `npm run dev` and `npm run preview`; a static-only
hosting service cannot run this endpoint.

1. Copy `.env.example` to `.env.local`.
2. Have the key owner enter `GEMINI_API_KEY` privately in that file. Never put it
   in a `VITE_` variable, commit it, or paste it into chat.
3. Set `GEMINI_LIVE_ACCESS_CODE` to a private demo code. This protects token
   creation even when using a public ngrok URL.
4. Set `GEMINI_LIVE_MODEL` to a Live model available to that Gemini project
   (the example uses `gemini-3.8-live`). A regular text-only model cannot be used.
5. Restart Vite: `npm run dev -- --port 5174 --strictPort`.
6. Connect an ESP32 or this device's camera. In **Ask your glasses**, enter the
   demo code, choose a microphone, and tap **Start assistant**. Allow microphone
   access. Ask “What am I looking at?”

For iPhone, open the HTTPS ngrok URL in Safari and keep the page in the foreground.
Start assistant is a user gesture that enables Safari audio playback. Ending the
conversation or hiding the page releases the assistant microphone and socket.
Camera capture remains under the existing camera controls. Audio-only conversation
works without a camera; the UI identifies when camera context is unavailable.
Sessions stop after eight minutes or when Gemini closes them; tap Start assistant
to begin a fresh session. Automatic session resumption is not implemented.

The assistant and browser voice commands are mutually exclusive: starting either
stops the other. Live conversations do not execute recording or note commands;
use the existing voice controls for those. Captions stay in memory and are cleared
on the next session. Gemini receives audio and JPEG camera frames during sessions.
Frames are sent at most once a second and scaled to a maximum width of 640 pixels.
The existing ESP32 preview still polls separately through the camera proxy; this
change does not lower its ngrok traffic.

Audio uses an AudioWorklet and signed 16-bit PCM at the actual microphone context
sample rate, which Gemini resamples; replies are played as 24 kHz PCM. Use headphones
if the speaker causes echo. Model access, billing, quotas, and region availability
are determined by the key owner's Gemini project. A configured key and an actual
phone are required to verify a complete live conversation.

Troubleshooting: a setup error means the server env is missing or Vite needs a
restart; an access-code error means the demo code differs from the server setting;
a Gemini session error can mean unavailable model access, quota, or connectivity.
Never expose the permanent key in error reports.

### ElevenLabs reply voice

To use ElevenLabs for the assistant's spoken replies, add both settings privately
to `.env.local`, then restart Vite:

```dotenv
ELEVENLABS_API_KEY=your_private_elevenlabs_key
ELEVENLABS_VOICE_ID=your_selected_voice_id
```

Choose a voice available to your ElevenLabs account and copy its voice ID. Keep
the existing Gemini settings and use the same demo access code in the dashboard.
Neither permanent API key is sent to the browser. `/api/live/speech` runs on the
server during development and preview, requires the demo code, and sends reply
text to ElevenLabs using `eleven_flash_v2_5`.

Gemini continues receiving camera frames and microphone audio. The app collects
its output transcript and requests ElevenLabs speech after the reply completes;
this adds latency compared with native Gemini playback. Gemini's generated audio
is suppressed in this mode, but still counts toward Gemini usage. ElevenLabs
usage is additional. Interrupting or ending a conversation cancels pending speech
and stops playback; interruption depends on Gemini's recognition events. Failed
speech requests show an error while the answer remains visible in captions.

Leave both ElevenLabs settings empty to use Gemini's voice. Setting only one
shows a setup error. Physical speaker playback and live ElevenLabs generation
require account credentials and manual testing. A production backend must also
implement `/api/live/speech`; static hosting cannot provide this route.
