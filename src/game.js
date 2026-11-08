/*
 * Neon Drift - a 3D neon endless runner
 * Built with Three.js (rendering, lights, shadows, fog) and the Web Audio API (src/audio.js).
 * Controls: keyboard, gamepad, touch swipe, or mouse click.
 */
(() => {
  'use strict';

  // ---------- Tunables ----------
  const LANES = [-2.4, 0, 2.4];
  const GRAVITY = 26;
  const JUMP_V = 10.5;
  const PLAYER_H = 1.0;
  const SLIDE_H = 0.45;
  const SLIDE_TIME = 0.75;
  const SPAWN_Z = -150;     // objects appear this far ahead
  const DESPAWN_Z = 8;      // and are removed once they pass the camera
  const SKY = 0x12002b;

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const scoreEl = $('score');
  const distEl = $('dist');
  const bestEl = $('best');
  const overlay = $('overlay');
  const titleEl = overlay.querySelector('h1');
  const msgEl = $('msg');

  // ---------- Renderer, scene, camera ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $('game').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 35, 160);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 400);
  const camBase = new THREE.Vector3(0, 3.2, 7);
  const camLook = new THREE.Vector3();
  camera.position.copy(camBase);

  // ---------- Lighting ----------
  const hemi = new THREE.HemisphereLight(0x8a5cff, 0x1a0030, 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(-6, 14, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -14;
  sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 14;
  sun.shadow.camera.bottom = -14;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  scene.add(sun);
  scene.add(sun.target);

  // Cyan light that travels with the player
  const playerLight = new THREE.PointLight(0x00f0ff, 2.2, 12, 1.6);
  scene.add(playerLight);

  // Magenta light far ahead that pulses
  const frontLight = new THREE.PointLight(0xff2bd6, 2.5, 40, 1.4);
  frontLight.position.set(0, 3, -18);
  scene.add(frontLight);

  // ---------- Ground with a neon grid texture ----------
  function makeGridTexture() {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = '#0b0218';
    g.fillRect(0, 0, size, size);

    g.lineWidth = 6;
    g.strokeStyle = '#ff2bd6';
    g.shadowColor = '#ff2bd6';
    g.shadowBlur = 14;
    g.strokeRect(3, 3, size - 6, size - 6);

    g.lineWidth = 3;
    g.strokeStyle = '#00f0ff';
    g.shadowColor = '#00f0ff';
    g.beginPath();
    g.moveTo(size / 2, 0);
    g.lineTo(size / 2, size);
    g.stroke();

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 40); // 60 units wide, 400 units long, one tile per 10 units
    tex.anisotropy = 8;
    return tex;
  }

  const gridTex = makeGridTexture();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 400),
    new THREE.MeshStandardMaterial({
      map: gridTex,
      emissiveMap: gridTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.55,
      roughness: 0.4,
      metalness: 0.1,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- Neon pillars on both sides (recycled) ----------
  const pillars = [];
  const pillarGeo = new THREE.BoxGeometry(1, 9, 1);
  const pillarMats = {
    left: new THREE.MeshStandardMaterial({ color: 0x100020, emissive: 0x00f0ff, emissiveIntensity: 0.9 }),
    right: new THREE.MeshStandardMaterial({ color: 0x100020, emissive: 0xff2bd6, emissiveIntensity: 0.9 }),
  };
  for (let i = 0; i < 20; i++) {
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(pillarGeo, side < 0 ? pillarMats.left : pillarMats.right);
      m.position.set(side * 11, 4.5, 8 - i * 8);
      m.castShadow = true;
      scene.add(m);
      pillars.push(m);
    }
  }

  // ---------- Stars ----------
  {
    const count = 1500;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 240;
      pos[i * 3 + 1] = 5 + Math.random() * 120;
      pos[i * 3 + 2] = -300 + Math.random() * 360;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, sizeAttenuation: true, transparent: true, opacity: 0.85 });
    scene.add(new THREE.Points(geo, mat));
  }

  // ---------- Player ----------
  const playerMesh = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00a0b0,
    emissiveIntensity: 0.6,
    roughness: 0.3,
    metalness: 0.2,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1, 0.8), bodyMat);
  body.position.y = 0.5;
  body.castShadow = true;
  playerMesh.add(body);

  const bodyEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(0.84, 1.04, 0.84)),
    new THREE.LineBasicMaterial({ color: 0xffffff })
  );
  bodyEdges.position.y = 0.5;
  playerMesh.add(bodyEdges);

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.2, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2 })
  );
  visor.position.set(0, 0.72, -0.43); // front faces -Z (the direction of travel)
  playerMesh.add(visor);

  scene.add(playerMesh);

  // ---------- Obstacles and coins ----------
  const blockGeo = new THREE.BoxGeometry(1.9, 1.6, 1.5);
  const blockMat = new THREE.MeshStandardMaterial({ color: 0x1a0a2e, emissive: 0xff2bd6, emissiveIntensity: 0.45, roughness: 0.5 });
  const blockEdgeGeo = new THREE.EdgesGeometry(blockGeo);
  const blockEdgeMat = new THREE.LineBasicMaterial({ color: 0xff2bd6 });

  function makeBlock() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(blockGeo, blockMat);
    m.position.y = 0.8;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    const e = new THREE.LineSegments(blockEdgeGeo, blockEdgeMat);
    e.position.y = 0.8;
    g.add(e);
    return g;
  }

  // Gate: a glowing beam you must slide under (bottom at y=0.9, top at y=1.6)
  const beamGeo = new THREE.BoxGeometry(2.0, 0.7, 0.6);
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 1.1 });
  const postGeo = new THREE.BoxGeometry(0.15, 1.6, 0.6);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x1a0a2e, emissive: 0x00f0ff, emissiveIntensity: 0.2 });

  function makeGate() {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 1.25;
    g.add(beam);
    for (const x of [-0.95, 0.95]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(x, 0.8, 0);
      post.castShadow = true;
      g.add(post);
    }
    return g;
  }

  const coinGeo = new THREE.TorusGeometry(0.35, 0.12, 8, 20);
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffaa00, emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.2 });

  const obstacles = []; // { obj, lane, bottom, top, half }
  const coins = [];     // { obj, lane, y, taken }

  function addObstacle(type, lane, z) {
    const isBlock = type === 'block';
    const obj = isBlock ? makeBlock() : makeGate();
    obj.position.set(LANES[lane], 0, z);
    scene.add(obj);
    obstacles.push({
      obj,
      lane,
      bottom: isBlock ? 0 : 0.9,
      top: 1.6,
      half: isBlock ? 0.75 : 0.3, // half the depth along Z
    });
  }

  function addCoin(lane, z, y) {
    const obj = new THREE.Mesh(coinGeo, coinMat);
    obj.position.set(LANES[lane], y, z);
    scene.add(obj);
    coins.push({ obj, lane, y, taken: false });
  }

  // ---------- Particles (pooled) ----------
  const particleGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  const particles = [];
  for (let i = 0; i < 120; i++) {
    const mesh = new THREE.Mesh(particleGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    mesh.visible = false;
    scene.add(mesh);
    particles.push({ mesh, vel: new THREE.Vector3(), life: 0, maxLife: 1 });
  }

  function burst(pos, color, count = 18, power = 6) {
    let spawned = 0;
    for (const p of particles) {
      if (p.life > 0) continue;
      p.life = p.maxLife = 0.6 + Math.random() * 0.5;
      p.mesh.position.copy(pos);
      p.mesh.material.color.setHex(color);
      p.mesh.visible = true;
      p.vel.set((Math.random() - 0.5) * power, Math.random() * power, (Math.random() - 0.5) * power);
      if (++spawned >= count) break;
    }
  }

  function updateParticles(dt, worldSpeed) {
    for (const p of particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= 15 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.position.z += worldSpeed * dt;
      p.mesh.scale.setScalar(Math.max(p.life / p.maxLife, 0.05));
    }
  }

  // ---------- Game state ----------
  const BEST_KEY = 'neonDriftBest';
  const state = {
    mode: 'menu', // 'menu' | 'playing' | 'paused' | 'over'
    time: 0,
    dist: 0,
    coins: 0,
    speed: 16,
    shake: 0,
    best: loadBest(),
  };

  const P = {
    lane: 1,
    x: 0,
    y: 0,
    vy: 0,
    h: PLAYER_H,
    sliding: false,
    slideT: 0,
  };

  let spawnTimer = 0;
  let fovCurrent = 70;

  function loadBest() {
    try {
      return Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch (e) {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      localStorage.setItem(BEST_KEY, String(value));
    } catch (e) {
      /* storage can be blocked; ignore */
    }
  }

  function clearWorld() {
    for (const o of obstacles) scene.remove(o.obj);
    for (const c of coins) scene.remove(c.obj);
    obstacles.length = 0;
    coins.length = 0;
  }

  function resetRun() {
    clearWorld();
    P.lane = 1;
    P.x = LANES[1];
    P.y = 0;
    P.vy = 0;
    P.h = PLAYER_H;
    P.sliding = false;
    P.slideT = 0;
    state.time = 0;
    state.dist = 0;
    state.coins = 0;
    state.speed = 16;
    spawnTimer = 0.8;
  }

  function showOverlay(title, message) {
    titleEl.textContent = title;
    msgEl.innerHTML = message;
    overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  function startRun() {
    Sound.unlock();
    resetRun();
    state.mode = 'playing';
    hideOverlay();
    Sound.sfx('start');
    Sound.startMusic();
    Sound.duck(false);
  }

  function togglePause() {
    if (state.mode === 'playing') {
      state.mode = 'paused';
      Sound.sfx('pause');
      Sound.duck(true);
      showOverlay('PAUSED', 'Press P, ESC or START to resume');
    } else if (state.mode === 'paused') {
      resume();
    }
  }

  function resume() {
    state.mode = 'playing';
    hideOverlay();
    Sound.sfx('pause');
    Sound.duck(false);
  }

  function gameOver() {
    state.mode = 'over';
    state.shake = 0.6;
    Sound.sfx('crash');
    Sound.stopMusic();
    burst(playerMesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 0x00f0ff, 50, 12);
    burst(playerMesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xff2bd6, 40, 10);

    const score = currentScore();
    const newBest = score > state.best;
    if (newBest) {
      state.best = score;
      saveBest(score);
    }
    showOverlay(
      'CRASHED',
      `Score <b>${score}</b> &middot; Best <b>${state.best}</b>${newBest ? ' <span style="color:#ffd23f">NEW!</span>' : ''}<br>` +
        'Press ENTER, SPACE or tap to retry'
    );
  }

  function currentScore() {
    return Math.floor(state.dist) + state.coins * 25;
  }

  // ---------- Player actions ----------
  function confirm() {
    if (state.mode === 'menu' || state.mode === 'over') startRun();
    else if (state.mode === 'paused') resume();
  }

  function moveLane(dir) {
    if (state.mode !== 'playing') return;
    const next = Math.max(0, Math.min(2, P.lane + dir));
    if (next !== P.lane) {
      P.lane = next;
      Sound.sfx('pause');
    }
  }

  function jump() {
    if (state.mode !== 'playing') return;
    if (P.y <= 0.001) {
      P.vy = JUMP_V;
      P.sliding = false;
      Sound.sfx('jump');
    }
  }

  function slide() {
    if (state.mode !== 'playing') return;
    if (P.y <= 0.001) {
      P.sliding = true;
      P.slideT = SLIDE_TIME;
      Sound.sfx('slide');
    } else {
      // Mid-air: slam down faster
      P.vy = -JUMP_V * 1.3;
    }
  }

  function act(action) {
    Sound.unlock();
    if (action === 'pause') {
      if (state.mode === 'playing' || state.mode === 'paused') togglePause();
      else confirm();
      return;
    }
    if (state.mode !== 'playing') {
      if (action === 'jump' || action === 'confirm') confirm();
      return;
    }
    if (action === 'left') moveLane(-1);
    else if (action === 'right') moveLane(1);
    else if (action === 'jump') jump();
    else if (action === 'slide') slide();
  }

  // ---------- Input: keyboard ----------
  const KEYS = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
    ArrowDown: 'slide', KeyS: 'slide',
    KeyP: 'pause', Escape: 'pause',
    Enter: 'confirm', NumpadEnter: 'confirm',
  };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') {
      Sound.toggleMute();
      return;
    }
    const action = KEYS[e.code];
    if (!action) return;
    e.preventDefault();
    if (e.repeat) return;
    act(action);
  });

  // ---------- Input: pointer / touch swipe ----------
  let pointerStart = null;
  window.addEventListener('pointerdown', (e) => {
    pointerStart = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('pointerup', (e) => {
    if (!pointerStart) return;
    const dx = e.clientX - pointerStart.x;
    const dy = e.clientY - pointerStart.y;
    pointerStart = null;
    const SWIPE = 30;
    if (Math.abs(dx) < SWIPE && Math.abs(dy) < SWIPE) {
      act('jump'); // tap
    } else if (Math.abs(dx) > Math.abs(dy)) {
      act(dx < 0 ? 'left' : 'right');
    } else {
      act(dy < 0 ? 'jump' : 'slide');
    }
  });

  // ---------- Input: gamepad ----------
  const prevPad = {};
  function pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;
      const btn = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
      const ax = pad.axes[0] || 0;
      const ay = pad.axes[1] || 0;
      const now = {
        A: btn(0),
        B: btn(1),
        Start: btn(9),
        Up: btn(12) || ay < -0.6,
        Down: btn(13) || ay > 0.6,
        Left: btn(14) || ax < -0.6,
        Right: btn(15) || ax > 0.6,
      };
      const prev = prevPad[pad.index] || {};
      const pressed = (k) => now[k] && !prev[k];

      if (pressed('A')) act('jump');
      if (pressed('B')) act('slide');
      if (pressed('Up')) act('jump');
      if (pressed('Down')) act('slide');
      if (pressed('Left')) act('left');
      if (pressed('Right')) act('right');
      if (pressed('Start')) act('pause');

      prevPad[pad.index] = now;
    }
  }

  // ---------- Spawning ----------
  function spawnPattern() {
    const z = SPAWN_Z;
    const r = Math.random();
    const lane = Math.floor(Math.random() * 3);

    if (r < 0.22) {
      addObstacle('block', lane, z);
    } else if (r < 0.42) {
      addObstacle('gate', lane, z);
    } else if (r < 0.55) {
      // Two blocks, one open lane: the player must pick the gap
      const open = Math.floor(Math.random() * 3);
      for (let l = 0; l < 3; l++) if (l !== open) addObstacle('block', l, z);
    } else if (r < 0.67) {
      // Gate in one lane, block in another
      const other = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
      addObstacle('gate', lane, z);
      addObstacle('block', other, z);
    } else if (r < 0.82) {
      // Coin trail on the ground
      for (let i = 0; i < 8; i++) addCoin(lane, z - i * 2.4, 1.0);
    } else {
      // Coins arcing over a block: you have to jump to collect them
      addObstacle('block', lane, z);
      for (let i = 0; i < 4; i++) addCoin(lane, z + 1.2 - i * 1.2, 2.2);
    }
  }

  function updateSpawning(dt) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnPattern();
      // Next pattern roughly 16-26 units ahead, so the gap shrinks as speed rises
      spawnTimer = (16 + Math.random() * 10) / state.speed;
    }
  }

  // ---------- Simulation ----------
  function updatePlayer(dt) {
    // Smooth lane change
    P.x += (LANES[P.lane] - P.x) * Math.min(1, dt * 14);

    // Jump and gravity
    const wasAir = P.y > 0.001;
    P.vy -= GRAVITY * dt;
    P.y += P.vy * dt;
    if (P.y <= 0) {
      P.y = 0;
      if (wasAir && P.vy < -4) Sound.sfx('land');
      P.vy = 0;
    }

    // Slide timer
    if (P.sliding) {
      P.slideT -= dt;
      if (P.slideT <= 0 || P.y > 0.001) P.sliding = false;
    }
    const targetH = P.sliding ? SLIDE_H : PLAYER_H;
    P.h += (targetH - P.h) * Math.min(1, dt * 18);

    playerMesh.position.set(P.x, P.y, 0);
    playerMesh.scale.y = P.h / PLAYER_H;

    // Tilt slightly into lane changes for some life
    playerMesh.rotation.z = (LANES[P.lane] - P.x) * -0.08;
  }

  function checkCollisions() {
    for (const o of obstacles) {
      const z = o.obj.position.z;
      if (o.lane !== P.lane || Math.abs(z) >= o.half + 0.4) continue;
      const overlapsVertically = P.y < o.top && P.y + P.h > o.bottom;
      if (overlapsVertically) {
        gameOver();
        return;
      }
    }

    for (const c of coins) {
      if (c.taken || c.lane !== P.lane) continue;
      const z = c.obj.position.z;
      if (Math.abs(z) < 1.0 && P.y < c.y + 0.5 && P.y + P.h > c.y - 0.5) {
        c.taken = true;
        scene.remove(c.obj);
        state.coins++;
        Sound.sfx('coin');
        burst(c.obj.position, 0xffd23f, 10, 5);
      }
    }
  }

  function update(dt) {
    const playing = state.mode === 'playing';
    const worldSpeed = playing ? state.speed : state.mode === 'menu' ? 6 : 0;

    if (playing) {
      state.time += dt;
      state.speed = Math.min(34, 16 + state.time * 0.35);
      state.dist += state.speed * dt;
      updatePlayer(dt);
      updateSpawning(dt);
    }

    // Scroll the world toward the camera
    gridTex.offset.y = (gridTex.offset.y + (worldSpeed * dt) / 10) % 1;
    for (const p of pillars) {
      p.position.z += worldSpeed * dt;
      if (p.position.z > 12) p.position.z -= 160;
    }
    for (const o of obstacles) o.obj.position.z += worldSpeed * dt;
    for (const c of coins) {
      c.obj.position.z += worldSpeed * dt;
      c.obj.rotation.y += dt * 3;
    }

    // Remove things that have passed the camera
    for (let i = obstacles.length - 1; i >= 0; i--) {
      if (obstacles[i].obj.position.z > DESPAWN_Z) {
        scene.remove(obstacles[i].obj);
        obstacles.splice(i, 1);
      }
    }
    for (let i = coins.length - 1; i >= 0; i--) {
      if (coins[i].taken || coins[i].obj.position.z > DESPAWN_Z) {
        scene.remove(coins[i].obj);
        coins.splice(i, 1);
      }
    }

    if (playing) checkCollisions();
    updateParticles(dt, worldSpeed);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);
  }

  // ---------- Camera, lights, HUD ----------
  function updateCamera(dt) {
    const playing = state.mode === 'playing';
    const targetFov = playing ? 70 + (state.speed - 16) * 0.25 : 70;
    fovCurrent += (targetFov - fovCurrent) * Math.min(1, dt * 4);
    camera.fov = fovCurrent;
    camera.updateProjectionMatrix();

    camBase.x += (P.x * 0.5 - camBase.x) * Math.min(1, dt * 6);
    camBase.y += (3.2 + P.y * 0.35 - camBase.y) * Math.min(1, dt * 6);
    camBase.z = 7;

    const shakeAmt = state.shake * 0.5;
    camera.position.set(
      camBase.x + (Math.random() - 0.5) * shakeAmt,
      camBase.y + (Math.random() - 0.5) * shakeAmt,
      camBase.z
    );
    camLook.set(P.x * 0.4, 1.2 + P.y * 0.3, -8);
    camera.lookAt(camLook);
  }

  function updateLights(now) {
    playerLight.position.set(P.x, P.y + 2.2, 1.5);
    frontLight.intensity = 2.5 + Math.sin(now * 0.004) * 0.6;
    sun.target.position.set(P.x * 0.5, 0, -4);
    sun.position.set(sun.target.position.x - 6, 14, sun.target.position.z + 8);
  }

  let lastHudScore = -1;
  let lastHudDist = -1;
  let lastHudBest = -1;
  function updateHud() {
    const score = currentScore();
    const meters = Math.floor(state.dist);
    if (score !== lastHudScore) {
      scoreEl.textContent = score;
      lastHudScore = score;
    }
    if (meters !== lastHudDist) {
      distEl.textContent = `${meters} m`;
      lastHudDist = meters;
    }
    if (state.best !== lastHudBest) {
      bestEl.textContent = state.best;
      lastHudBest = state.best;
    }
  }

  // ---------- Main loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    pollGamepad();
    update(dt);
    updateCamera(dt);
    updateLights(now);
    updateHud();
    renderer.render(scene, camera);

    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Start in the menu state
  resetRun();
  state.mode = 'menu';
  bestEl.textContent = state.best;
  showOverlay('NEON DRIFT', 'Press ENTER, SPACE or tap to start');
  requestAnimationFrame(frame);
})();
