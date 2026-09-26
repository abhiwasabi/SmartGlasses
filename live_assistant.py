"""Session state and alert memory for a stream of observed events."""

import time

from decision_engine import event_urgency, handle_event


URGENCY_LEVEL = {"ignore": 0, "normal": 1, "medium": 2, "high": 3, "critical": 4}


class AlertMemory:
    """Limit repeated speech while allowing escalation and a closer warning."""

    def __init__(self, cooldown=5.0, quiet_retry=1.0, clock=None):
        self.cooldown = cooldown
        self.quiet_retry = quiet_retry
        self.clock = clock or time.monotonic
        self._recent = {}

    @staticmethod
    def _key(context, goal, event):
        identity = event.get("track_id")
        if identity is not None:
            identity = (event.get("source"), event.get("type"), identity)
        else:
            identity = (
                event.get("source"),
                event.get("type"),
                event.get("direction"),
                event.get("description"),
            )
        return (context.lower(), goal.strip().lower(), str(identity))

    @staticmethod
    def _distance(event):
        try:
            value = float(event["distance"])
            return value if value >= 0 else None
        except (KeyError, TypeError, ValueError):
            return None

    def should_process(self, context, goal, event, urgency):
        previous = self._recent.get(self._key(context, goal, event))
        if previous is None:
            return True
        if URGENCY_LEVEL.get(urgency, 0) > URGENCY_LEVEL.get(previous["urgency"], 0):
            return True
        distance = self._distance(event)
        old_distance = previous["distance"]
        if (distance is not None and old_distance is not None and old_distance > 0
                and distance < old_distance and distance <= old_distance * 0.6):
            return True
        interval = self.cooldown if previous["spoke"] else self.quiet_retry
        return self.clock() - previous["time"] >= interval

    def record(self, context, goal, event, urgency, spoke):
        self._recent[self._key(context, goal, event)] = {
            "time": self.clock(),
            "urgency": urgency,
            "distance": self._distance(event),
            "spoke": spoke,
        }
        if len(self._recent) > 512:
            oldest = min(self._recent, key=lambda key: self._recent[key]["time"])
            del self._recent[oldest]


class LiveAssistant:
    """Process successive detector events using the current user context and goal."""

    def __init__(self, context="walking", goal="", memory=None):
        self.context = context
        self.goal = goal
        self.memory = memory if memory is not None else AlertMemory()

    def set_session(self, context=None, goal=None):
        if context is not None:
            self.context = context
        if goal is not None:
            self.goal = goal
        return {"context": self.context, "goal": self.goal}

    def process_event(self, event, context=None, goal=None):
        current_context = context if context is not None else self.context
        current_goal = goal if goal is not None else self.goal
        try:
            urgency = event_urgency(current_context, event)
        except (TypeError, ValueError):
            urgency = "ignore"

        if not self.memory.should_process(current_context, current_goal, event, urgency):
            return {"status": "suppressed", "message": None}

        message = handle_event(current_context, event, goal=current_goal or None)
        self.memory.record(current_context, current_goal, event, urgency, bool(message))
        return {"status": "spoken" if message else "quiet", "message": message}
