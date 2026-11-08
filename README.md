# Neon Drift

Neon Drift is a browser-based endless runner game inspired by the feel of high-speed neon lane runners. Built with plain HTML, CSS, and JavaScript, it uses Three.js for the 3D scene and the Web Audio API for synth-based sound effects.

## Features

- Endless 3D neon track with forward motion
- Lane switching, jumping, and sliding mechanics
- Obstacle avoidance and increasing difficulty
- Score tracking and best-score persistence
- Keyboard and gamepad controls
- Mobile-friendly touch/swipe support
- Mute toggle and pause menu

## How to Run

Because this project is a lightweight static web app, you can run it without a build step.

### Option 1: Open directly

Open `index.html` in a browser.

### Option 2: Use a local web server

From the project root:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Controls

- Left / Right or A / D: change lane
- Up / W / Space: jump
- Down / S: slide
- P / ESC: pause
- M: mute
- Gamepad: supported
- Mobile: swipe to control movement

## Project Structure

```text
.
├── index.html
├── style.css
├── src/
│   ├── audio.js
│   └── game.js
└── .vscode/
```

## Notes

- The game loads Three.js from a CDN, so an internet connection is required on first load.
- No package installation or bundler setup is required.
- This repo is intended for quick browser play and experimentation.

## License

This project does not currently include a license file. If you plan to share or reuse it publicly, consider adding an open-source license such as MIT.
