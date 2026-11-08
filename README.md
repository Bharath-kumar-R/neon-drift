# Neon Drift

![Neon Drift](https://img.shields.io/badge/HTML5-Game-ff2bd6?style=for-the-badge&logo=html5) ![Three.js](https://img.shields.io/badge/Three.js-3D-00f0ff?style=for-the-badge&logo=three.js) ![JavaScript](https://img.shields.io/badge/JavaScript-ES6-F7DF1E?style=for-the-badge&logo=javascript) ![Web%20Audio](https://img.shields.io/badge/Web-Audio-8b5cf6?style=for-the-badge&logo=html5)

Neon Drift is a fast-paced endless runner built with HTML, CSS, and JavaScript, with a stylized neon visual theme and a smooth pseudo-3D lane-based movement system. The project uses Three.js to render the scene and the Web Audio API to generate sound effects and music-like feedback.

## Gameplay

The player races down a glowing neon track while dodging obstacles, switching lanes, jumping over barriers, and sliding under hazards. As the run continues, the speed increases and the challenge ramps up, creating a classic arcade rhythm of survival and reaction.

## Features

- Endless neon runner gameplay
- 3D-inspired lane-based motion
- Jump and slide actions for obstacle avoidance
- Score and distance tracking
- Best-score memory in the browser
- Keyboard, gamepad, and touch controls
- Pause, mute, and start/restart flow
- Lightweight static web app with no install step

## Demo

You can run the game locally by opening the project in a browser.

### Run locally

```bash
python -m http.server 8000
```

Then visit:

```text
http://localhost:8000
```

You can also open `index.html` directly in a browser for quick testing.

## Controls

- Left / Right or A / D: change lane
- Up / W / Space: jump
- Down / S: slide
- P / ESC: pause
- M: mute
- Gamepad: supported
- Mobile: swipe to move

## Project Structure

```text
.
├── index.html
├── style.css
├── src/
│   ├── audio.js
│   └── game.js
├── .vscode/
├── .gitignore
└── README.md
```

## Screenshot / Preview

This project is designed to be visually striking in-browser, with a neon cyberpunk HUD and glowing track aesthetic. If you want to add a preview image to the repo, place it in a folder such as `assets/` and reference it here.

Example:

```md
![Neon Drift gameplay preview](assets/neon-drift-preview.png)
```

## Tech Stack

- HTML5
- CSS3
- JavaScript
- Three.js
- Web Audio API

## Notes

- The project uses a CDN-hosted Three.js script, so an internet connection is required on first load.
- No build step or package installation is needed.
- This is a lightweight browser game intended for quick experimentation and local play.

## License

This repository does not currently include a license file. If you plan to share or reuse the project publicly, consider adding an open-source license like MIT.

## Contributing

Contributions are welcome. If you want to improve gameplay, visuals, controls, or sound design, feel free to fork the repository and submit a pull request.
