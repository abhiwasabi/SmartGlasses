from elevenlabs_voice import speak


def calculate_time_to_contact(distance, closing_speed):
    """
    Estimate how many seconds until the user and object
    reach the same position.

    distance: meters
    closing_speed: meters per second

    Positive closing speed = getting closer.
    Zero/negative = not getting closer.
    """

    if distance is None:
        return None

    distance = max(float(distance), 0.0)

    if closing_speed is None:
        return None

    closing_speed = float(closing_speed)

    if closing_speed <= 0:
        return float("inf")

    return distance / closing_speed


def estimate_closing_speed(
    user_speed,
    object_speed=None,
    object_motion="stationary"
):
    """
    Estimate closing speed when an explicit closing_speed
    was not supplied.

    object_motion can be:

    "stationary"
    "same_direction"
    "toward_user"
    "away_from_user"

    Speeds are in meters per second.
    """

    user_speed = max(float(user_speed or 0.0), 0.0)

    if object_speed is None:
        object_speed = 0.0

    object_speed = max(float(object_speed), 0.0)

    if object_motion == "stationary":
        return user_speed

    if object_motion == "same_direction":
        return max(
            user_speed - object_speed,
            0.0
        )

    if object_motion == "toward_user":
        return user_speed + object_speed

    if object_motion == "away_from_user":
        return max(
            user_speed - object_speed,
            0.0
        )

    # Safe fallback
    return user_speed


def get_urgency(
    context: str,
    event_type: str,
    distance,
    closing_speed
):
    """
    Determine urgency based primarily on time-to-contact,
    with context-specific fallback rules.
    """

    if distance is None:
        return "normal"

    distance = max(float(distance), 0.0)

    time_to_contact = calculate_time_to_contact(
        distance,
        closing_speed
    )

    # -----------------------------------
    # RELATIVE-MOTION URGENCY
    # -----------------------------------

    if time_to_contact is not None:

        if time_to_contact <= 1.0:
            return "critical"

        if time_to_contact <= 2.5:
            return "high"

        if time_to_contact <= 5.0:
            return "medium"

    # -----------------------------------
    # CONTEXT-SPECIFIC FALLBACKS
    # -----------------------------------

    if context == "driving":

        if event_type in [
            "person_ahead",
            "obstacle_ahead",
            "vehicle_ahead"
        ]:
            if distance <= 30:
                return "medium"

        if event_type == "close_following":

            if distance <= 5:
                return "critical"

            if distance <= 10:
                return "high"

            if distance <= 20:
                return "medium"


    elif context == "walking":

        if event_type in [
            "chair_detected",
            "person_ahead",
            "obstacle_ahead",
            "stairs_ahead",
            "door_detected"
        ]:
            if distance <= 3:
                return "medium"


    elif context == "running":

        if event_type in [
            "person_ahead",
            "obstacle_ahead",
            "stairs_ahead",
            "door_detected"
        ]:
            if distance <= 6:
                return "medium"


    elif context == "biking":

        if event_type in [
            "person_ahead",
            "obstacle_ahead",
            "vehicle_ahead"
        ]:
            if distance <= 15:
                return "medium"


    elif context == "indoors":

        if event_type in [
            "chair_detected",
            "door_detected",
            "person_ahead",
            "obstacle_ahead",
            "stairs_ahead"
        ]:
            if distance <= 2.5:
                return "medium"

    return "ignore"


def build_object_message(
    object_name,
    distance=None,
    direction=None,
    urgency="normal"
):
    """
    Build a short spoken message based on urgency.
    """

    if urgency == "critical":
        message = (
            f"Warning. {object_name.capitalize()} "
            f"directly ahead"
        )

    elif urgency == "high":
        message = f"{object_name.capitalize()} ahead"

    elif urgency == "medium":
        message = object_name.capitalize()

    else:
        message = object_name.capitalize()

    # Only mention direction if useful
    if direction and direction != "center":
        message += f" on your {direction}"

    # Medium alerts can afford to be more descriptive
    if (
        distance is not None
        and urgency == "medium"
    ):
        message += (
            f", about {float(distance):.1f} "
            f"meters away"
        )

    message += "."

    return message


def decide_response(context: str, event: dict):
    """
    Decide:
    1. Whether this event matters
    2. Its urgency
    3. What the assistant should say
    """

    context = context.lower()

    event_type = event.get("type")

    distance = event.get("distance")

    direction = event.get(
        "direction",
        "center"
    )

    confidence = event.get(
        "confidence",
        1.0
    )

    user_speed = event.get(
        "user_speed",
        0.0
    )

    object_speed = event.get(
        "object_speed"
    )

    object_motion = event.get(
        "object_motion",
        "stationary"
    )

    supplied_closing_speed = event.get(
        "closing_speed"
    )

    # -----------------------------------
    # CONFIDENCE FILTER
    # -----------------------------------

    if confidence < 0.70:
        return None


    # -----------------------------------
    # DETERMINE CLOSING SPEED
    # -----------------------------------

    if supplied_closing_speed is not None:

        closing_speed = float(
            supplied_closing_speed
        )

    else:

        closing_speed = estimate_closing_speed(
            user_speed=user_speed,
            object_speed=object_speed,
            object_motion=object_motion
        )


    # -----------------------------------
    # DETERMINE URGENCY
    # -----------------------------------

    urgency = get_urgency(
        context=context,
        event_type=event_type,
        distance=distance,
        closing_speed=closing_speed
    )

    if urgency == "ignore":
        return None


    # -----------------------------------
    # DEBUG INFORMATION
    # -----------------------------------

    time_to_contact = (
        calculate_time_to_contact(
            distance,
            closing_speed
        )
    )

    print(
        f"Closing speed: "
        f"{closing_speed:.2f} m/s"
    )

    if (
        time_to_contact is not None
        and time_to_contact != float("inf")
    ):
        print(
            f"Estimated time to contact: "
            f"{time_to_contact:.2f} seconds"
        )

    else:
        print(
            "Estimated time to contact: "
            "not approaching"
        )

    print(
        f"Urgency: {urgency}"
    )


    # -----------------------------------
    # SPECIAL EVENTS
    # -----------------------------------

    if event_type == "lane_drift":
        return "Watch your lane."

    if event_type == "close_following":

        if urgency == "critical":
            return (
                "Too close. Increase your "
                "following distance."
            )

        return (
            "Increase your following distance."
        )


    # -----------------------------------
    # GENERAL OBJECT EVENTS
    # -----------------------------------

    object_names = {

        "chair_detected":
            "chair",

        "door_detected":
            "door",

        "person_ahead":
            "person",

        "stairs_ahead":
            "stairs",

        "obstacle_ahead":
            "obstacle",

        "vehicle_ahead":
            "vehicle"
    }

    if event_type in object_names:

        object_name = (
            object_names[event_type]
        )

        if (
            context == "driving"
            and event_type == "person_ahead"
        ):
            object_name = "pedestrian"

        return build_object_message(
            object_name=object_name,
            distance=distance,
            direction=direction,
            urgency=urgency
        )

    return None


def handle_event(
    context: str,
    event: dict
):
    """
    Process an event and speak
    if the assistant decides it matters.
    """

    print()
    print("-------------------------")
    print("NEW EVENT")
    print("-------------------------")

    print(
        f"Context: {context}"
    )

    print(
        f"Event: {event}"
    )

    message = decide_response(
        context=context,
        event=event
    )

    if message:

        print(
            f"Decision: {message}"
        )

        speak(message)

    else:

        print(
            "Decision: No alert needed."
        )


if __name__ == "__main__":

    test_event = {

        "type": "vehicle_ahead",

        "distance": 15,

        "direction": "center",

        "confidence": 0.96,

        "user_speed": 10.0,

        "object_speed": 2.0,

        "object_motion":
            "same_direction"
    }

    handle_event(
        context="driving",
        event=test_event
    )
