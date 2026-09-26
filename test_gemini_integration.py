"""Offline checks for Gemini decisions and the speech fallback path."""

import contextlib
import io
import json
import os
import sys
import types
import unittest
from unittest.mock import patch

import decision_engine
import gemini_reasoner


class GeminiIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.event = {
            "type": "chair_detected",
            "distance": 2.0,
            "direction": "right",
            "confidence": 0.95,
            "user_speed": 0.0,
        }

    def fake_google(self, answer=None, error=None):
        calls = []

        class Client:
            def __init__(self, **kwargs):
                self.models = self

            def generate_content(self, **kwargs):
                calls.append(kwargs)
                if error:
                    raise error
                return types.SimpleNamespace(text=json.dumps(answer))

            def close(self):
                pass

        google = types.ModuleType("google")
        genai = types.ModuleType("google.genai")
        genai.Client = Client
        genai.types = types.SimpleNamespace(HttpOptions=lambda **kwargs: kwargs)
        google.genai = genai
        return calls, {"google": google, "google.genai": genai}

    def test_no_key_uses_rule_based_alert(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            self.assertEqual(
                gemini_reasoner.reason_about_event("indoors", self.event, "Chair."),
                "Chair.",
            )

    def test_gemini_can_suppress_medium_alert(self):
        calls, modules = self.fake_google({"should_alert": False, "urgency": "ignore", "message": ""})
        with patch.dict(sys.modules, modules), patch.dict(os.environ, {"GEMINI_API_KEY": "test"}):
            result = gemini_reasoner.reason_about_event("indoors", self.event, "Chair.")
        self.assertIsNone(result)
        self.assertEqual(len(calls), 1)
        self.assertIn("chair_detected", calls[0]["contents"])

    def test_gemini_failure_uses_rule_based_alert(self):
        _, modules = self.fake_google(error=TimeoutError("late"))
        with patch.dict(sys.modules, modules), patch.dict(os.environ, {"GEMINI_API_KEY": "test"}):
            with contextlib.redirect_stdout(io.StringIO()):
                result = gemini_reasoner.reason_about_event("indoors", self.event, "Chair.")
        self.assertEqual(result, "Chair.")

    def test_urgent_alert_bypasses_gemini_and_reaches_speech(self):
        urgent = {**self.event, "distance": 0.5, "closing_speed": 1.0}
        spoken = []
        voice = types.ModuleType("elevenlabs_voice")
        voice.speak = spoken.append
        with patch.dict(sys.modules, {"elevenlabs_voice": voice}):
            with patch.object(decision_engine, "reason_about_event", side_effect=AssertionError("called")):
                with contextlib.redirect_stdout(io.StringIO()):
                    decision_engine.handle_event("indoors", urgent)
        self.assertEqual(spoken, ["Warning. Chair directly ahead on your right."])

    def test_suppressed_medium_alert_does_not_reach_speech(self):
        spoken = []
        voice = types.ModuleType("elevenlabs_voice")
        voice.speak = spoken.append
        with patch.dict(sys.modules, {"elevenlabs_voice": voice}):
            with patch.object(decision_engine, "reason_about_event", return_value=None) as reason:
                with contextlib.redirect_stdout(io.StringIO()):
                    decision_engine.handle_event("indoors", self.event)
        reason.assert_called_once()
        self.assertEqual(spoken, [])

    def test_new_goal_reaches_gemini_even_without_a_rule(self):
        event = {"type": "bin_visible", "description": "Trash bin on the right", "confidence": 0.98}
        spoken = []
        voice = types.ModuleType("elevenlabs_voice")
        voice.speak = spoken.append
        with patch.dict(sys.modules, {"elevenlabs_voice": voice}):
            with patch.object(decision_engine, "reason_about_event", return_value="Trash bin on your right.") as reason:
                with contextlib.redirect_stdout(io.StringIO()):
                    decision_engine.handle_event("throw this wrapper away", event)
        reason.assert_called_once_with("throw this wrapper away", event, None, "normal", None)
        self.assertEqual(spoken, ["Trash bin on your right."])

    def test_explicit_goal_is_sent_to_gemini(self):
        event = {"type": "bin_visible", "description": "Trash bin on the right"}
        calls, modules = self.fake_google({
            "should_alert": True,
            "urgency": "normal",
            "message": "Trash bin on your right.",
        })
        with patch.dict(sys.modules, modules), patch.dict(os.environ, {"GEMINI_API_KEY": "test"}):
            result = gemini_reasoner.reason_about_event(
                "walking", event, goal="throw away this wrapper"
            )
        self.assertEqual(result, "Trash bin on your right.")
        self.assertIn("throw away this wrapper", calls[0]["contents"])


if __name__ == "__main__":
    unittest.main()
