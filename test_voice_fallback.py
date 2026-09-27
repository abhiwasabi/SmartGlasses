"""Windows speech remains available when ElevenLabs rejects the account."""

import types
import unittest
from unittest.mock import patch

import elevenlabs_voice


class VoiceFallbackTests(unittest.TestCase):
    def test_unauthorized_elevenlabs_uses_windows_voice_without_retrying(self):
        class Unauthorized(Exception):
            status_code = 401

        requests = []
        spoken = []
        client = types.SimpleNamespace(
            text_to_speech=types.SimpleNamespace(
                stream=lambda **kwargs: requests.append(kwargs) or object()
            )
        )
        with patch.object(elevenlabs_voice, "client", client), \
             patch.object(elevenlabs_voice, "stream", side_effect=Unauthorized()), \
             patch.object(elevenlabs_voice, "_speak_windows", side_effect=spoken.append), \
             patch.object(elevenlabs_voice.os, "name", "nt"), \
             patch.object(elevenlabs_voice, "_next_elevenlabs_retry", 0.0):
            elevenlabs_voice.speak("Obstacle ahead.")
            elevenlabs_voice.speak("Chair closer.")

        self.assertEqual(len(requests), 1)
        self.assertEqual(spoken, ["Obstacle ahead.", "Chair closer."])


if __name__ == "__main__":
    unittest.main()
