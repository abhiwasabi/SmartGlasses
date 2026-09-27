"""Offline checks for camera-frame reasoning and the local receiver."""

import json
import os
import sys
import threading
import types
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from event_receiver import create_server
from gemini_scene import SceneAssessment, SceneUnavailable, analyze_frame
from live_assistant import LiveAssistant


class SceneReasonerTests(unittest.TestCase):
    def test_missing_key_reports_unavailable(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            with self.assertRaises(SceneUnavailable):
                analyze_frame(b"jpeg", "walking", "find a bin")

    def test_frame_and_arbitrary_goal_reach_gemini(self):
        calls = []

        class Client:
            def __init__(self, **kwargs):
                self.models = self

            def generate_content(self, **kwargs):
                calls.append(kwargs)
                return types.SimpleNamespace(text=json.dumps({
                    "should_alert": True, "label": "trash bin", "direction": "right",
                    "message": "Trash bin on your right.",
                }))

            def close(self):
                pass

        google = types.ModuleType("google")
        genai = types.ModuleType("google.genai")
        genai.Client = Client
        genai.types = types.SimpleNamespace(
            HttpOptions=lambda **kwargs: kwargs,
            Part=types.SimpleNamespace(from_bytes=lambda **kwargs: kwargs),
        )
        google.genai = genai
        with patch.dict(sys.modules, {"google": google, "google.genai": genai}), patch.dict(
            os.environ, {"GEMINI_API_KEY": "test", "GEMINI_ENABLED": "true"}
        ):
            result = analyze_frame(b"jpeg", "cleaning", "throw away this wrapper")
        self.assertEqual(result.message, "Trash bin on your right.")
        self.assertIn("throw away this wrapper", calls[0]["contents"][0])
        self.assertEqual(calls[0]["contents"][1], {"data": b"jpeg", "mime_type": "image/jpeg"})

    def test_invalid_alert_is_rejected(self):
        answer = SceneAssessment(should_alert=True, label="bin", direction="right", message=" ")
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test"}), patch("gemini_scene.SceneAssessment.model_validate_json", return_value=answer), patch("google.genai.Client") as client:
            client.return_value.models.generate_content.return_value.text = "{}"
            with self.assertRaises(SceneUnavailable):
                analyze_frame(b"jpeg", "walking", "find a bin")


class FrameReceiverTests(unittest.TestCase):
    def setUp(self):
        self.assistant = LiveAssistant(context="cleaning", goal="throw away wrapper")
        self.server = create_server(port=0, assistant=self.assistant)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def post_frame(self, frame=b"\xff\xd8body\xff\xd9", content_type="image/jpeg"):
        request = Request(self.base + "/api/frame", data=frame,
                          headers={"Content-Type": content_type}, method="POST")
        with urlopen(request, timeout=2) as response:
            return json.load(response)

    def test_scene_alert_speaks_once_and_is_suppressed(self):
        assessment = SceneAssessment(should_alert=True, label="trash bin", direction="right",
                                     message="Trash bin on your right.")
        with patch("live_assistant.analyze_frame", return_value=assessment) as analyze, patch("elevenlabs_voice.speak") as speak:
            self.assertEqual(self.post_frame(), {"status": "spoken", "message": assessment.message})
            self.assertEqual(self.post_frame(), {"status": "suppressed", "message": None})
        self.assertEqual(analyze.call_count, 2)
        analyze.assert_called_with(b"\xff\xd8body\xff\xd9", "cleaning", "throw away wrapper")
        speak.assert_called_once_with(assessment.message)

    def test_frame_validation_and_missing_gemini_are_visible(self):
        with self.assertRaises(HTTPError) as invalid:
            self.post_frame(b"not a jpeg")
        self.assertEqual(invalid.exception.code, 400)
        with self.assertRaises(HTTPError) as wrong_type:
            self.post_frame(content_type="text/plain")
        self.assertEqual(wrong_type.exception.code, 400)
        with patch("live_assistant.analyze_frame", side_effect=SceneUnavailable("Gemini is unavailable")):
            with self.assertRaises(HTTPError) as unavailable:
                self.post_frame()
        self.assertEqual(unavailable.exception.code, 503)
        self.assertEqual(json.load(unavailable.exception)["error"], "Gemini is unavailable")

    def test_session_is_restored_and_cross_origin_read_is_forbidden(self):
        with urlopen(self.base + "/api/session", timeout=2) as response:
            self.assertEqual(json.load(response), {"context": "cleaning", "goal": "throw away wrapper"})
        request = Request(self.base + "/api/session", headers={"Origin": "https://attacker.example"})
        with self.assertRaises(HTTPError) as denied:
            urlopen(request, timeout=2)
        self.assertEqual(denied.exception.code, 403)


if __name__ == "__main__":
    unittest.main()
