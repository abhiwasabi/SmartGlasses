# Clarity hardware companion

Imported from [work-yugtilva/shellhacks-hardware](https://github.com/work-yugtilva/shellhacks-hardware) at commit `7cb9252b64c9070172b222260504aacbf40e3853`.
The original firmware, Python companion, tests, and YOLO model are preserved unchanged. See [the upstream README](UPSTREAM_README.md).

## Contents

- [`firmware/CameraWebServer/`](firmware/CameraWebServer/README.md): AI-Thinker ESP32-CAM firmware, Wi-Fi access point, MJPEG stream, and GPIO 13 button state logging.
- `laptop/lanetalk/`: Python camera reader, object/lane detection, coaching, and speech modules.
- `laptop/tests/`: companion tests.
- `laptop/yolo11n.pt`: upstream detection model.

## Run the separate Python companion

From this repository's root:

```sh
python3 -m venv hardware/laptop/.venv
source hardware/laptop/.venv/bin/activate
python -m pip install -r hardware/laptop/requirements.txt
cd hardware/laptop
python -m lanetalk.app
```

The camera reader defaults to `http://192.168.4.1/stream`. Connect the laptop to the camera access point before running. Use a separate internet connection if online services are needed. Run its tests from the repository root with:

```sh
hardware/laptop/.venv/bin/python -m unittest discover -s hardware/laptop/tests
```

## Compatibility with the Clarity web app

This addition does not change the frontend, backend, npm dependencies, account setup, or existing camera connection.

The imported firmware serves `/stream` but does not provide `/capture`. Clarity's existing web camera proxy requires `/capture`, so this firmware is not yet a drop-in replacement for the firmware used by the web app. Keep the working firmware on your board until a snapshot endpoint or stream adapter is implemented and tested.

The Python companion runs independently; its detections and button logs are not connected to Clarity's web assistant. Firmware compilation and physical-board behavior have not been verified as part of this import.

Before flashing, set your camera access point credentials as described in the firmware README. Keep private credentials out of Git commits. The upstream repository did not include a license file; this import records its source and preserves its original files.
