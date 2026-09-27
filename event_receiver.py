"""Local HTTP bridge from a detector or dashboard to the wearable assistant.

POST /api/session with {"context": "walking", "goal": "find a trash bin"}.
POST /api/events with {"event": {"type": "bin_visible", ...}}.
POST /api/frame with a JPEG body to ask Gemini about the current goal.
The server binds to loopback so API keys and spoken goals stay on this machine.
"""

import argparse
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlsplit

from live_assistant import LiveAssistant
from gemini_scene import SceneUnavailable


MAX_BODY_BYTES = 16_384
MAX_FRAME_BYTES = 524_288
ALLOWED_ORIGINS = {
    f"http://{host}:{port}"
    for host in ("localhost", "127.0.0.1")
    for port in (5173, 5174, 4173)
}


def _session_text(value, field, allow_empty=False):
    if not isinstance(value, str) or len(value) > 200 or (not allow_empty and not value.strip()):
        raise ValueError(f"{field} must be a short string")
    return value.strip()


def create_server(port=8765, assistant=None):
    """Return a loopback HTTP server; port 0 chooses an available test port."""
    assistant = assistant if assistant is not None else LiveAssistant()

    class Handler(BaseHTTPRequestHandler):
        def _send(self, status, payload):
            content = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            origin = self.headers.get("Origin")
            if origin in ALLOWED_ORIGINS:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
            self.end_headers()
            self.wfile.write(content)

        def _read_body(self):
            try:
                size = int(self.headers.get("Content-Length", "0"))
            except ValueError as exc:
                raise ValueError("Content-Length must be a number") from exc
            if size < 1 or size > MAX_BODY_BYTES:
                raise ValueError("JSON body must be between 1 and 16384 bytes")
            try:
                payload = json.loads(self.rfile.read(size))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise ValueError("body must contain valid JSON") from exc
            if not isinstance(payload, dict):
                raise ValueError("body must be a JSON object")
            return payload

        def _allowed_origin(self):
            origin = self.headers.get("Origin")
            return origin is None or origin in ALLOWED_ORIGINS

        def _read_frame(self):
            if self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower() != "image/jpeg":
                raise ValueError("frame must use image/jpeg")
            try:
                size = int(self.headers.get("Content-Length", "0"))
            except ValueError as exc:
                raise ValueError("Content-Length must be a number") from exc
            if size < 4 or size > MAX_FRAME_BYTES:
                raise ValueError("JPEG frame must be between 4 and 524288 bytes")
            frame = self.rfile.read(size)
            if not (frame.startswith(b"\xff\xd8") and frame.endswith(b"\xff\xd9")):
                raise ValueError("frame must be a JPEG image")
            return frame

        def do_OPTIONS(self):
            if not self._allowed_origin():
                self._send(403, {"error": "origin not allowed"})
                return
            self.send_response(204)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Content-Length", "0")
            origin = self.headers.get("Origin")
            if origin:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
            self.end_headers()

        def do_GET(self):
            if not self._allowed_origin():
                self._send(403, {"error": "origin not allowed"})
            elif urlsplit(self.path).path == "/health":
                self._send(200, {"status": "ready"})
            elif urlsplit(self.path).path == "/api/session":
                self._send(200, {"context": assistant.context, "goal": assistant.goal})
            else:
                self._send(404, {"error": "unknown path"})

        def do_POST(self):
            if not self._allowed_origin():
                self._send(403, {"error": "origin not allowed"})
                return
            path = urlsplit(self.path).path
            if path not in ("/api/session", "/api/events", "/api/frame"):
                self._send(404, {"error": "unknown path"})
                return
            try:
                if path == "/api/frame":
                    result = assistant.process_frame(self._read_frame())
                    self._send(200, result)
                    return
                payload = self._read_body()
                if path == "/api/session":
                    if not any(key in payload for key in ("context", "goal")):
                        raise ValueError("context or goal is required")
                    context = _session_text(payload["context"], "context") if "context" in payload else None
                    goal = _session_text(payload["goal"], "goal", allow_empty=True) if "goal" in payload else None
                    result = assistant.set_session(context=context, goal=goal)
                else:
                    event = payload.get("event")
                    if not isinstance(event, dict):
                        raise ValueError("event must be an object")
                    if not any(isinstance(event.get(key), str) and event[key].strip()
                               for key in ("type", "description")):
                        raise ValueError("event needs a type or description")
                    context = _session_text(payload["context"], "context") if "context" in payload else None
                    goal = _session_text(payload["goal"], "goal", allow_empty=True) if "goal" in payload else None
                    result = assistant.process_event(event, context=context, goal=goal)
            except ValueError as exc:
                self._send(400, {"error": str(exc)})
                return
            except SceneUnavailable as exc:
                self._send(503, {"error": str(exc)})
                return
            except Exception:
                self.log_error("event processing failed")
                self._send(500, {"error": "event processing failed"})
                return
            self._send(200, result)

    return HTTPServer(("127.0.0.1", port), Handler)


def main():
    parser = argparse.ArgumentParser(description="Local SmartGlasses event receiver")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = create_server(port=args.port)
    print(f"SmartGlasses receiver listening on http://127.0.0.1:{server.server_port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
