import os
import shutil
import subprocess
import time
from pathlib import Path

from dotenv import load_dotenv
from elevenlabs import stream
from elevenlabs.client import ElevenLabs


load_dotenv(".env.local")
load_dotenv()

API_KEY = os.getenv("ELEVENLABS_API_KEY")
VOICE_ID = os.getenv(
    "ELEVENLABS_VOICE_ID",
    "JBFqnCBsd6RMkjVDRZzb"
)

client = ElevenLabs(api_key=API_KEY, timeout=10) if API_KEY else None
_next_elevenlabs_retry = 0.0


def _speak_windows(text: str):
    powershell = Path(os.environ.get("WINDIR", r"C:\Windows")) / "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe"
    command = (
        '$ErrorActionPreference = "Stop"; '
        '$voice = New-Object -ComObject SAPI.SpVoice; '
        '[void]$voice.Speak([Console]::In.ReadToEnd())'
    )
    subprocess.run(
        [str(powershell), "-NoProfile", "-NonInteractive", "-Command", command],
        input=text,
        text=True,
        capture_output=True,
        check=True,
        timeout=20,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )


def speak(text: str):
    global _next_elevenlabs_retry
    if os.name == "nt" and shutil.which("mpv") is None:
        program_files = Path(os.environ.get("ProgramFiles", r"C:\Program Files"))
        installed_mpv = program_files / "MPV Player" / "mpv.exe"
        if installed_mpv.is_file():
            os.environ["PATH"] = str(installed_mpv.parent) + os.pathsep + os.environ.get("PATH", "")

    print(f"LaneTalk: {text}")

    if client is not None and time.monotonic() >= _next_elevenlabs_retry:
        try:
            audio_stream = client.text_to_speech.stream(
                text=text,
                voice_id=VOICE_ID,
                model_id="eleven_flash_v2_5",
                output_format="mp3_22050_32",
            )
            stream(audio_stream)
            return
        except Exception as exc:
            if os.name != "nt":
                raise
            # An unauthorized key cannot recover during this process. For
            # transient errors, retry the preferred voice after one minute.
            _next_elevenlabs_retry = (
                float("inf") if getattr(exc, "status_code", None) == 401
                else time.monotonic() + 60
            )
            print(f"ElevenLabs unavailable ({type(exc).__name__}); using Windows voice.")

    if os.name != "nt":
        raise RuntimeError("ELEVENLABS_API_KEY was not found in .env")
    _speak_windows(text)


if __name__ == "__main__":
    speak("Lane Talk is online. WHICH MEANS THE CODE WORKS")
