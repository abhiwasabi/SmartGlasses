"""Checks for streamed events, goal changes, and repeat suppression."""

import json
import sys
import threading
import types
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from unittest.mock import patch

from event_receiver import create_server
from live_assistant import AlertMemory, LiveAssistant


class LiveAssistantTests(unittest.TestCase):
    def setUp(self):
        self.now = 100.0
        self.memory = AlertMemory(clock=lambda: self.now)
        self.assistant = LiveAssistant(context="walking", goal="find a bin", memory=self.memory)
        self.event = {"type": "bin_visible", "description": "bin on the right", "track_id": "bin-1"}

    def test_repeated_observation_is_quiet_until_cooldown(self):
        with patch("live_assistant.handle_event", return_value="Bin on your right.") as handle:
            first = self.assistant.process_event(self.event)
            second = self.assistant.process_event(self.event)
            self.now += 5.1
            third = self.assistant.process_event(self.event)
        self.assertEqual(first["status"], "spoken")
        self.assertEqual(second["status"], "suppressed")
        self.assertEqual(third["status"], "spoken")
        self.assertEqual(handle.call_count, 2)
        handle.assert_called_with("walking", self.event, goal="find a bin")

    def test_new_goal_can_make_the_same_object_relevant(self):
        with patch("live_assistant.handle_event", return_value="Bin on your right.") as handle:
            self.assistant.process_event(self.event)
            self.assistant.set_session(goal="throw away wrapper")
            result = self.assistant.process_event(self.event)
        self.assertEqual(result["status"], "spoken")
        self.assertEqual(handle.call_count, 2)

    def test_urgency_escalation_and_rapid_approach_bypass_cooldown(self):
        event = {"type": "chair_detected", "track_id": "chair-1", "distance": 5.0,
                 "confidence": 0.95, "closing_speed": 0.0}
        with patch("live_assistant.handle_event", return_value="Chair ahead.") as handle:
            self.assistant.process_event(event)
            closer = {**event, "distance": 2.0}
            self.assistant.process_event(closer)
            urgent = {**closer, "closing_speed": 3.0}
            self.assistant.process_event(urgent)
        self.assertEqual(handle.call_count, 3)

    def test_unhelpful_event_is_rechecked_after_short_interval(self):
        with patch("live_assistant.handle_event", return_value=None) as handle:
            self.assistant.process_event(self.event)
            self.assistant.process_event(self.event)
            self.now += 1.1
            self.assistant.process_event(self.event)
        self.assertEqual(handle.call_count, 2)


class ReceiverTests(unittest.TestCase):
    def test_goal_and_event_reach_live_assistant_over_http(self):
        assistant = LiveAssistant()
        server = create_server(port=0, assistant=assistant)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_port}"

        def post(path, payload):
            request = Request(base + path, data=json.dumps(payload).encode(),
                              headers={"Content-Type": "application/json"}, method="POST")
            with urlopen(request, timeout=2) as response:
                return json.load(response)

        try:
            self.assertEqual(post("/api/session", {"context": "walking", "goal": "throw away wrapper"}),
                             {"context": "walking", "goal": "throw away wrapper"})
            event = {"type": "bin_visible", "description": "bin on the right", "track_id": "bin-1"}
            with patch("live_assistant.handle_event", return_value="Bin on your right.") as handle:
                self.assertEqual(post("/api/events", {"event": event})["status"], "spoken")
                self.assertEqual(post("/api/events", {"event": event})["status"], "suppressed")
            handle.assert_called_once_with("walking", event, goal="throw away wrapper")
            with urlopen(base + "/health", timeout=2) as response:
                self.assertEqual(json.load(response), {"status": "ready"})
            with self.assertRaises(HTTPError) as error:
                post("/api/events", {"event": {}})
            self.assertEqual(error.exception.code, 400)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

    def test_http_event_reaches_gemini_decision_and_speech(self):
        server = create_server(port=0)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_port}"
        spoken = []
        voice = types.ModuleType("elevenlabs_voice")
        voice.speak = spoken.append

        def post(path, payload):
            request = Request(base + path, data=json.dumps(payload).encode(),
                              headers={"Content-Type": "application/json"}, method="POST")
            with urlopen(request, timeout=2) as response:
                return json.load(response)

        try:
            post("/api/session", {"context": "walking", "goal": "throw away wrapper"})
            event = {"type": "bin_visible", "description": "bin on the right", "confidence": 0.95}
            with patch.dict(sys.modules, {"elevenlabs_voice": voice}), patch(
                "decision_engine.reason_about_event", return_value="Bin on your right."
            ) as reason:
                result = post("/api/events", {"event": event})
            self.assertEqual(result, {"status": "spoken", "message": "Bin on your right."})
            self.assertEqual(spoken, ["Bin on your right."])
            reason.assert_called_once_with("walking", event, None, "normal", "throw away wrapper")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
