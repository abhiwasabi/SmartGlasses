import os
import shutil
from pathlib import Path

from dotenv import load_dotenv
from elevenlabs import stream
from elevenlabs.client import ElevenLabs


load_dotenv()

API_KEY = os.getenv("ELEVENLABS_API_KEY")
VOICE_ID = os.getenv(
    "ELEVENLABS_VOICE_ID",
    "JBFqnCBsd6RMkjVDRZzb"
)

if not API_KEY:
    raise RuntimeError(
        "ELEVENLABS_API_KEY was not found in .env"
    )

client = ElevenLabs(api_key=API_KEY)


def speak(text: str):
    if os.name == "nt" and shutil.which("mpv") is None:
        program_files = Path(os.environ.get("ProgramFiles", r"C:\Program Files"))
        installed_mpv = program_files / "MPV Player" / "mpv.exe"
        if installed_mpv.is_file():
            os.environ["PATH"] = str(installed_mpv.parent) + os.pathsep + os.environ.get("PATH", "")

    print(f"LaneTalk: {text}")

    audio_stream = client.text_to_speech.stream(
        text=text,
        voice_id=VOICE_ID,
        model_id="eleven_flash_v2_5",
        output_format="mp3_22050_32",
    )

    stream(audio_stream)


if __name__ == "__main__":
    speak("Lane Talk is online. WHICH MEANS THE CODE WORKS")
