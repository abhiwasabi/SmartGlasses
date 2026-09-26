# Clarity — Voice-powered smart glasses

## Project purpose

Clarity is the companion app for a pair of smart glasses equipped with a camera, microphone, and speaker. The goal is to give users a hands-free AI assistant that can understand what they are looking at, answer spoken questions using live camera context, and capture moments and notes through voice commands.

The glasses provide visual and audio input, and the assistant responds through the speaker. The app provides a place to review and manage saved videos, clips, and notes later.

## Core experiences

### 1. Ask questions about the world in view

- The user asks a question through the microphone, such as “What's in front of me?” or “What am I looking at?”
- The assistant uses recent frames from the glasses' camera together with the spoken question and relevant conversation context to identify visible objects and describe the scene.
- The assistant gives a clear, concise spoken answer through the glasses' speaker.
- Answers must be grounded in the available camera view. If the view is unclear, outdated, or unavailable, the assistant explains that limitation instead of inventing visual details.

### 2. Record videos and clip moments

- The user can start and stop video recording with spoken commands such as “Start recording” and “Stop recording.”
- The user can request a short clip with a command such as “Clip this” or “Clip a memory.”
- Completed recordings and clips are saved to the app's library for later playback and download.
- The app makes recording state and successful saves clear. A failed capture or save must not be reported as successful.
- Clip timing must match the implemented capture behavior. The current app records the next 30 seconds after a clip command; capturing moments before the command would require a recording buffer.

### 3. Take notes by voice

- The user starts a note with a command such as “Make a new note,” then dictates its contents.
- Spoken words are transcribed into a text note. Commands such as “Save note” and “Cancel note” finish or discard the note.
- Saved notes remain available in the app for later reading and editing.
- Command phrases used to control note-taking should not become part of the saved note text.

### 4. Review saved content

- The companion app is the user's library for recordings, clips, and notes.
- Users can browse saved content, play videos, read and edit notes, and download recordings.
- The library starts empty and contains content the user creates. Saved content should remain available across app reloads, subject to the storage system's limits.

## Product principles

- **Hands-free interaction:** After initial setup and permission grants, voice is the primary way to ask questions and capture content.
- **Visual grounding:** The camera provides context for questions about the user's surroundings.
- **Clear feedback:** Users should know when the assistant is listening, recording, taking a note, saving, or unable to complete a request.
- **User control:** Camera and microphone access require permission, and users can stop listening or recording.
- **Useful recall:** Captured moments and notes should be easy to find and review later.

## Current implementation and intended direction

This document describes the product's purpose and intended experience; it does not imply that every capability is already complete. Consult the code and README for setup details and current behavior.

- The companion dashboard uses React and TypeScript and supports configured ESP32-CAM devices or the phone/computer camera as a development input.
- The visual assistant currently uses Gemini Live to receive microphone audio and selected camera frames and return spoken answers.
- Visual conversations and recording/note voice controls currently run in separate, mutually exclusive modes. A unified voice experience is the intended direction; live assistant conversations do not yet execute capture or note commands.
- Saved content currently lives in the user's browser: notes and settings in localStorage, and video files in IndexedDB. Cross-device synchronization is not implemented, and clearing browser site data removes saved content.
- Actual glasses microphone and speaker integration depends on the hardware connection and supported audio routing. Browser camera, microphone, and speaker support alone does not establish a complete glasses hardware integration.

## Success criteria

The complete product should let a user wearing the glasses:

1. Ask “What's in front of me?” and hear an answer grounded in the current camera view.
2. Start and stop a recording by voice and find the saved video in the app.
3. Request a short clip by voice and review the saved clip later.
4. Dictate and save a note by voice and read or edit it in the app.
5. Receive understandable feedback when camera context, audio input, connectivity, or storage is unavailable.

Future changes should support this central goal: helping users understand what they see and save what matters through a voice-powered pair of glasses.
