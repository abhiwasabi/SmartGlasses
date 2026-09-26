# SmartGlasses for Expo Go

This is a separate mobile adaptation of the SmartGlasses dashboard, based on the repository's `main` branch at commit `959ba68`. It lives on local branch `expo-go-local`. Nothing here has been pushed to GitHub.

## What works

- Camera scene scans guided by a free-form goal, such as “find a trash bin.” Gemini decides which visible details matter and returns a short alert.
- Optional repeat scans every seven seconds while the Assist screen is open.
- Typed or recorded questions about the live camera view, with spoken answers from the phone.
- Typed or dictated notes stored on the phone.
- Photo and up-to-30-second video memories stored on the phone, with playback and sharing.

The laptop companion service calls Gemini. The API key is never bundled into Expo Go. The existing `.env` file in `C:\Users\leona\Documents\Shellhacks` remains the source of `GEMINI_API_KEY`. The app uses the phone's own speech synthesis; the browser dashboard's WebAudio and Gemini Live session are not part of this mobile flow.

## Start on your laptop

Open two PowerShell terminals in this `mobile` directory:

```powershell
cd 'C:\Users\leona\Documents\Codex\2026-09-26\https-github-com-abhiwasabi-smartglasses\work\expo-go-local\mobile'
npm install
npm run server
```

The ignored `server/.env.local` has already been created on this laptop. For a fresh setup, copy `server/.env.example` to `server/.env.local`, then set `SMARTGLASSES_ENV_FILE` to the absolute path of a laptop `.env` containing `GEMINI_API_KEY`, and set a unique `MOBILE_ACCESS_CODE`. The service listens on port 8766. Keep the laptop and phone on a trusted Wi-Fi network.

In the second terminal:

```powershell
cd 'C:\Users\leona\Documents\Codex\2026-09-26\https-github-com-abhiwasabi-smartglasses\work\expo-go-local\mobile'
npm start -- --lan
```

Scan Expo's QR code with Expo Go. This project uses Expo SDK 57. On Android, install the SDK 57 version of Expo Go from Google Play or [Expo's download page](https://expo.dev/go?device=true&platform=android&sdkVersion=57). An older Expo Go version will report an SDK mismatch.

## Connect the phone

1. In the app, open **Settings**. Set the service URL to `http://<laptop Wi-Fi IPv4 address>:8766`. The **Use Expo host** shortcut may fill this for you when Expo is running in LAN mode. You can find the laptop IPv4 address with `ipconfig` in PowerShell.
2. Find the access code in the ignored `server/.env.local` on your laptop. Enter it in **Settings**, then tap **Save** and **Test**.
3. Enter any goal, such as “help me find a trash bin,” and save preferences. On **Assist**, allow camera and microphone permissions as prompted.

To display just the code in PowerShell:

```powershell
(Get-Content 'server/.env.local' | Where-Object { $_ -like 'MOBILE_ACCESS_CODE=*' }) -replace '^MOBILE_ACCESS_CODE=', ''
```

If the service test fails from your phone, make sure both devices use the same Wi-Fi, the laptop service is running, and Windows Firewall allows Node.js on the private network. `http://127.0.0.1:8766/health` on the laptop should report `geminiConfigured: true`.

## Checks

```powershell
npm run typecheck
npm run test:server
npx expo export --platform ios --output-dir dist-ios
npx expo export --platform android --output-dir dist-android
```

Expo bundle checks cannot verify camera, microphone, video, or LAN access on a physical phone. Test those flows in Expo Go before relying on them.
