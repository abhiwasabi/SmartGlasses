# SmartGlasses decision and voice prototype

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
`.env.example` to `.env` in a new checkout and replace the placeholder API keys.
Keep `.env` private. Gemini uses `GEMINI_API_KEY`; ElevenLabs uses
`ELEVENLABS_API_KEY`. Run `python -m unittest -v test_gemini_integration.py`
for offline checks, then run `python decision_engine.py` for the voice demo.

Known high and critical alerts use the rule-based message immediately. Gemini
handles other sufficiently confident events, including unknown types and goals.
If Gemini is unavailable, known events use their rule-based message. Gemini
receives the context, goal, and event fields you pass to `handle_event`.

## Live event receiver

Run `python event_receiver.py` in the Shellhacks folder. It listens only on
`http://127.0.0.1:8765`, so API keys stay in the local `.env`. The receiver
accepts detected events from another process, applies the current activity and
goal, and sends useful alerts to ElevenLabs. Check `GET /health` for readiness.

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

The dashboard on `main` captures images and recordings but does not yet emit
object detections. A detector must send observations to `/api/events`; camera
video alone cannot provide object type, distance, or motion. The receiver is a
single-user local prototype and processes one request at a time. A phone or
deployed dashboard needs a trusted same-origin backend connection before it can
use this receiver remotely. Run all offline checks with
`python -m unittest -v test_gemini_integration.py test_live_integration.py`.
