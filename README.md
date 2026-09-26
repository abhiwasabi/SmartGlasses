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
