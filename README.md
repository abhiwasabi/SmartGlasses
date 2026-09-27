# Clarity · SmartGlasses Dashboard

A React and TypeScript dashboard for the [SmartGlasses project](https://github.com/abhiwasabi/SmartGlasses). Capture camera footage and dictate notes through hands-free voice commands. Review saved content in the dashboard.

---

### 🛡️ State Farm Auto Insurance & Claims Co-Pilot
Clarity transforms wearable smart glasses into an everyday **Auto Insurance & Driver Risk Co-Pilot**:
- **Hands-Free Accident Claims Co-Pilot:** Spoken emergency guidance (*"I was in an accident"* or *"State Farm claim"*). Clarity will calm driver panic, check for injuries, prompt hazard lights, and visually record evidence (license plates, policy cards, vehicular damage) hands-free via the smart glasses cameras.
- **Automated Claim Packet Generation:** Generates structured, timestamped loss reports in the dashboard tagged with `State Farm Claim`.
- **1-Click State Farm Online Claim Filer:** The **"File on State Farm"** button copies all structured claim details to the clipboard and directly launches State Farm's official digital claims portal ([`reportloss.claims.statefarm.com/start-claim`](https://reportloss.claims.statefarm.com/start-claim)).
- **SafePark™ Vehicle Theft & Break-In Prevention:** Interactive protocol educating drivers on vehicle theft reduction (hiding valuables before arriving), parking garage safety, Comprehensive vs. Collision coverage, and insurance discounts (**Good Student Discount**, **Drive Safe & Save™**).
- **Drive Mode Safety:** Hands-free claims co-pilot accessible while driving without touching the phone.

### 🚗 Waymo Transit & Safe Mobility Navigation
Clarity brings autonomous-grade perception and public mobility intelligence to everyday pedestrians, riders, and drivers:
- **Waymo Autonomous Pickup Navigator:** Identifies designated safe curb loading zones on campus (avoiding bike lanes, fire lanes, and congested transit stops) with ADA ramp access, lighting ratings, and designated passenger cut-outs.
- **Pedestrian Vision Shield:** Clarity will alert pedestrians hands-free to crosswalk signals (Walk vs. Don't Walk), turning vehicles, and approaching micro-mobility through real-time audio-visual perception.
- **Campus Routes & Elevation Intelligence:** Integrates Google Maps walking directions, elevation profiles, and illuminated night corridors for low-risk navigation.
- **1-Click Google Maps Integration:** Direct launch into Google Maps from dashboard cards and voice-generated mobility notes.

---

## Features

- **Waymo Autonomous Mobility Co-Pilot:** Designated safe curb pickup bays, pedestrian vision shield, and Google Maps campus route navigation.
- **State Farm Auto Insurance Co-Pilot:** Complete hands-free accident protocol, visual evidence capture, and online claim filing integration.
- Camera preview and recording, with a choice of two configured ESP32-CAM devices or the phone/computer camera.
- Recording playback and download, with saved recordings included in the memory library.
- Voice-dictated reminders and lecture notes summarized into readable, titled notes when saved, with manual editing for corrections.
- A microphone status panel, live transcript, command guide, and optional acknowledgement tones.
- Drive Mode for brief spoken road-hazard and driving-coaching alerts from the selected camera.
- Settings for the two ESP32-CAM addresses.
- Email/password accounts with private, per-user notes and memory storage through Supabase.
- An empty workspace that contains only notes, recordings, and events you create.
- Clarity voice conversations about the current camera view.

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

## User accounts and cloud storage

Clarity uses Supabase Auth for email/password accounts, Postgres for notes and memory metadata, and a private Storage bucket for recordings. Each row and file is protected by Row Level Security so it is available only to its owner.

1. Create a free Supabase project.
2. Open **SQL Editor**, paste [`supabase/setup.sql`](supabase/setup.sql), and run it once.
3. Copy `.env.example` to `.env.local` and add the project URL and publishable key shown under **Project Settings → API**:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

4. Restart `npm run dev`, then create an account from the Clarity login screen. If email confirmation is enabled in Supabase, confirm the message before signing in.

The publishable key is designed for browser use; never put a Supabase service-role key in a `VITE_` variable. Existing browser notes and memory metadata are imported into the first account when its cloud workspace is empty. Existing recording files upload when they are first opened.

## iPhone demo

The phone layout includes bottom navigation, safe-area spacing for the notch and home indicator, touch controls, and text inputs sized to avoid Safari keyboard zoom. Open the dashboard in Safari and keep the page in the foreground while capturing. Choose **This device** to use the iPhone camera; it prefers the rear camera on initial connection. Safari uses the iPhone's default microphone for voice recognition.

The iPhone must open an **HTTPS URL with a trusted certificate**. `127.0.0.1` on the phone refers to the phone, not the computer running Vite. An ordinary `http://<computer-LAN-IP>:5174` URL may display the layout but does not enable secure camera/microphone APIs. For ESP32 capture, the HTTPS origin must forward `/api/camera/capture` to the dashboard server running on the camera network; static frontend hosting alone is insufficient. This repository does not publish or configure that HTTPS endpoint automatically.

After Supabase is configured, notes and videos follow the signed-in account across devices. Test permission prompts, speech recognition, recording, playback, downloading, and cloud upload on the physical iPhone before the final demo. Desktop phone-size testing does not verify iOS media services.

## Hands-free voice controls

Choose a camera and configure its address once. Under voice controls, select an input from **Microphone**, then click **Enable voice** and allow access. The dropdown updates automatically when microphones are connected or disconnected. Before microphone permission is granted, the browser may hide device names or additional inputs; enabling voice refreshes the list after permission is granted. Pause voice before changing the input. The selection is remembered on this browser. Specific microphone routing uses desktop Chromium 135 or newer; other browsers use **System default**. Unplugged selected inputs produce an error instead of switching to a different microphone. Keep the dashboard open. Speak English commands:

| Say | Result |
| --- | --- |
| “Start recording” | Connects the selected camera if necessary, then starts recording. |
| “Stop recording” | Stops and saves the recording to Memories. |
| “Clip a memory” / “Clip this” | Saves the previous 15 seconds from the connected camera buffer. |
| “Make a new note” followed by your words | Starts dictation; finalized words are saved to the same note as you speak. |
| “Save note” | Finishes the current note and returns to command listening. |
| “Cancel note” | Discards the note being dictated. |
| “Stop listening” | Saves finalized note text, if any, and pauses the microphone. |

You can say a complete note in one utterance: “Make a new note remember to charge the glasses save note.” Finish phrases are excluded from saved content. During dictation, recording phrases are treated as note content; finish the note before issuing another recording command. Pausing microphone access preserves finalized text, but unfinished recognition text is not committed.

A clip uses the latest 15 seconds buffered while the camera is connected. Connect the camera and allow the buffer to fill before asking for a clip. The buffer pauses during a longer recording; stop that recording before asking for a memory clip.

The frontend uses the [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) with the selected microphone (or system default). This does not add an audio transport to the ESP32 camera firmware. A dedicated glasses microphone needs to be exposed as a browser audio input or integrated with a speech-to-text backend.

Speech recognition is not supported by every browser or embedded preview. Chrome is a practical option; the app shows an explicit error when recognition or its service is unavailable. Some browsers send audio to their speech service and need internet access. This browser command mode has no custom transcription backend or API key requirement; Gemini Live below has separate server settings. Microphone listening does not start automatically on page load; a user gesture and permission are required, and a spoken “stop listening” command cannot re-enable a paused microphone. The initial enable step is manual.

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


---

## Goal-based alerts and Python decision engine

`handle_event(context, event, goal=None)` accepts a context, an observed event,
and an optional natural-language goal. Gemini can decide whether to speak about
events outside the fixed rule list. For example, a goal to discard a wrapper can
make a newly detected trash bin relevant.

```python
from decision_engine import handle_event

handle_event(
    context="walking",
    goal="throw away this wrapper",
    event={
        "type": "bin_visible",
        "description": "Trash bin on the right",
        "confidence": 0.95,
    },
)
```

Install dependencies with `python -m pip install -r requirements.txt`. Copy
`.env.example` to `.env.local` and enter private API keys there. Both assistant
modes use `GEMINI_API_KEY`; ElevenLabs uses `ELEVENLABS_API_KEY`. Run
`python -m unittest -v test_gemini_integration.py` for offline checks, then run
`python decision_engine.py` for the voice demo.

Known high and critical alerts use the rule-based message immediately. Gemini
handles other sufficiently confident events, including unknown types and goals.
If Gemini is unavailable, known events use their rule-based message. Gemini
receives the context, goal, and event fields you pass to `handle_event`.

## Live event receiver

The Overview dashboard has a **What are you trying to do?** form. Start the
receiver on the same computer as the dashboard, then enter any activity and
goal and click **Set goal**. The form saves both to `POST /api/session` and
restores them from `GET /api/session` on reload. Clearing the goal keeps the
rule-based safety alerts active.

Connect an ESP32 or device camera in the dashboard, then click **Scan once**
or **Start scanning**. Each scan downsizes one current frame to at most 640px
and sends its JPEG bytes to `POST /api/frame` on the local receiver. Gemini
looks for something clearly visible that helps the saved goal, such as a trash
bin when the goal is to discard a wrapper. Its short answer enters the same
spoken-alert cooldown as detector events. Continuous scanning waits five
seconds after each request finishes before starting another; it stops when
the camera disconnects or the goal changes. Camera frames leave this computer
for Gemini only after you press a scan control. A single image cannot establish
metric distance or closing speed, so scene alerts make neither claim. The
existing `/api/events` path remains available for detector measurements.
Goal-based scanning pauses during Gemini Live conversations so the two spoken
assistants do not talk over each other.

The dashboard form and scan controls currently work from a browser on the
same computer as the receiver; on a phone, `127.0.0.1` points to the phone
instead. A trusted backend proxy is needed for a phone or deployed dashboard.

Run `python event_receiver.py` in the Shellhacks folder. It listens only on
`http://127.0.0.1:8765`, so API keys stay in the local `.env`. The receiver
accepts detected events from another process, applies the current activity and
goal, and sends useful alerts to ElevenLabs. On Windows, if ElevenLabs is
unavailable, the assistant speaks through the installed Windows voice instead.
An ElevenLabs 401 disables retries until the receiver restarts. Check
`GET /health` for readiness.
On this Windows laptop, make mpv available in that terminal first if it is not
already on `PATH`: `$env:Path = 'C:\Program Files\MPV Player;' + $env:Path`.

Set the user's activity and goal from PowerShell:

```powershell
Invoke-RestMethod http://127.0.0.1:8765/api/session -Method Post -ContentType 'application/json' -Body '{"context":"walking","goal":"throw away this wrapper"}'
```

Send an observation from a detector or a test process:

```powershell
Invoke-RestMethod http://127.0.0.1:8765/api/events -Method Post -ContentType 'application/json' -Body '{"event":{"type":"bin_visible","description":"Trash bin on the right","direction":"right","confidence":0.95,"track_id":"bin-1"}}'
```

An event request can also include `context` or `goal` alongside `event` to
override the saved session for that request. The response has `status` of
`spoken`, `quiet`, or `suppressed`, plus the spoken `message` when applicable.
Send stable `track_id` values for objects across frames. Repeats of the same
object are suppressed for five seconds after an alert; a higher rule urgency or
a substantial decrease in distance can trigger another alert sooner. Events
that produced no speech can be reconsidered after one second. Changing the goal
lets the same object be reconsidered immediately.

The dashboard can now ask Gemini to interpret individual camera frames. It
does not calculate distance or relative motion from those frames. A detector
can send those measurements to `/api/events` for time-to-contact alerts. The
receiver is a single-user local prototype and processes one request at a
time. Run all offline checks with
`python -m unittest -v test_gemini_integration.py test_live_integration.py test_scene_integration.py test_voice_fallback.py`.
## Gemini Live visual assistant

The dashboard can stream microphone audio and the selected camera to Gemini Live,
then play spoken replies and show input/output captions. The server mints a
single-session ephemeral token; the permanent Gemini key never reaches React.
The token route runs with both `npm run dev` and `npm run preview`; a static-only
hosting service cannot run this endpoint.

1. The shared `.env` contains the public Supabase browser configuration. Copy
   `.env.example` to `.env.local` for private settings; `.env.local` is ignored by
   Git. The Python receiver also reads its Gemini and ElevenLabs keys from there.
2. Have the key owner enter `GEMINI_API_KEY` in `.env.local`. Never put it in a
   `VITE_` variable, commit it, or paste it into chat.
3. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for local
   dashboard use. Signed-in account sessions protect token creation, including
   when using a public URL.
4. Set `GEMINI_LIVE_MODEL` to a Live model available to that Gemini project
   (the example uses `gemini-3.8-live`). A regular text-only model cannot be used.
5. Restart Vite: `npm run dev -- --port 5174 --strictPort`.
6. Sign in, connect an ESP32 or this device's camera, choose a microphone in
   **Ask your glasses**, and tap **Start assistant**. Allow microphone access.
   Ask “What am I looking at?”

For iPhone, open the HTTPS ngrok URL in Safari and keep the page in the foreground.
Start assistant is a user gesture that enables Safari audio playback. Ending the
conversation or hiding the page releases the assistant microphone and socket.
Camera capture remains under the existing camera controls. Audio-only conversation
works without a camera; the UI identifies when camera context is unavailable.
Sessions stop after eight minutes or when Gemini closes them; tap Start assistant
to begin a fresh session. Automatic session resumption is not implemented.

The assistant and browser voice commands are mutually exclusive: starting either
stops the other. During a Gemini Live session, explicit recording, 15-second clip,
and note commands use Gemini function calling to trigger the app's existing capture
and note storage actions. The browser voice controls remain available as a fallback.
When you say “save note,” Gemini returns a short descriptive title and an
organized plain-text summary. Short reminders stay concise; longer lectures use
headings and bullets for the main ideas and details. Draft speech is still saved
as you speak, so an unfinished note remains available if the Live session ends.
Captions stay in memory and are cleared on the next session. Gemini receives audio
and JPEG camera frames during sessions.
Frames are sent at most once a second and scaled to a maximum width of 640 pixels.
The existing ESP32 preview still polls separately through the camera proxy; this
change does not lower its ngrok traffic.

Audio uses an AudioWorklet and signed 16-bit PCM at the actual microphone context
sample rate, which Gemini resamples; replies are played as 24 kHz PCM. Use headphones
if the speaker causes echo. Model access, billing, quotas, and region availability
are determined by the key owner's Gemini project. A configured key and an actual
phone are required to verify a complete live conversation.

Troubleshooting: a setup error means the server env is missing or Vite needs a
restart; an account-session error means the user should sign in again; a Gemini
session error can mean unavailable model access, quota, or connectivity.
Never expose the permanent key in error reports.

### ElevenLabs reply voice

To use ElevenLabs for the assistant's spoken replies, add both settings privately
to `.env`, then restart Vite:

```dotenv
ELEVENLABS_API_KEY=your_private_elevenlabs_key
ELEVENLABS_VOICE_ID=your_selected_voice_id
```

Choose a voice available to your ElevenLabs account and copy its voice ID. Keep
the existing Gemini and Supabase settings in the dashboard.
Neither permanent API key is sent to the browser. `/api/live/speech` runs on the
server during development and preview, requires a valid signed-in account, and sends reply
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
