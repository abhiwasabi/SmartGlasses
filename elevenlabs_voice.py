import os

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
