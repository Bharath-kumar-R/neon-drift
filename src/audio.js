/*
 * Neon Drift - audio
 * Everything is synthesized with the Web Audio API, so there are no sound
 * files to download. Music is a small step sequencer (bass, lead, kick, hats).
 */
const Sound = (() => {
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let noiseBuffer = null;

  let muted = false;
  let musicOn = false;
  let timerId = null;
  let step = 0;
  let nextNoteTime = 0;

  const BPM = 124;
  const STEP = 60 / BPM / 4; // one 16th note in seconds

  // Frequencies (Hz) for an A-minor groove
  const BASS = [55, 55, 65.41, 55, 82.41, 55, 73.42, 55, 55, 55, 65.41, 55, 98, 82.41, 73.42, 65.41];
  const LEAD = [440, 523.25, 659.25, 523.25, 880, 659.25, 523.25, 659.25,
                392, 493.88, 587.33, 493.88, 783.99, 587.33, 493.88, 587.33];

  function ensureContext() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.5;
    sfxBus.connect(master);

    musicBus = ctx.createGain();
    musicBus.gain.value = 0.22;
    musicBus.connect(master);

    // One second of white noise, reused by every noise-based sound
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    return true;
  }

  // Browsers only allow audio after a user gesture, so call this from input handlers.
  function unlock() {
    if (!ensureContext()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }

  function envelope(gainNode, t, peak, attack, duration) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  }

  function tone(type, freq, t, duration, peak, destination, slideTo = null) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    envelope(gain, t, peak, 0.005, duration);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  function noise(t, duration, peak, destination, filterType = 'highpass', freq = 2000) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    envelope(gain, t, peak, 0.002, duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    src.start(t);
    src.stop(t + duration + 0.05);
  }

  // ---------- Sound effects ----------
  const effects = {
    jump: (t) => tone('square', 300, t, 0.22, 0.22, sfxBus, 900),
    slide: (t) => noise(t, 0.22, 0.25, sfxBus, 'bandpass', 1200),
    land: (t) => noise(t, 0.08, 0.3, sfxBus, 'lowpass', 400),
    coin: (t) => {
      tone('triangle', 1318.5, t, 0.12, 0.4, sfxBus);
      tone('triangle', 1975.5, t + 0.07, 0.18, 0.35, sfxBus);
    },
    start: (t) => {
      tone('square', 220, t, 0.12, 0.2, sfxBus, 440);
      tone('square', 440, t + 0.12, 0.2, 0.2, sfxBus, 880);
    },
    pause: (t) => tone('triangle', 660, t, 0.1, 0.25, sfxBus),
    crash: (t) => {
      noise(t, 0.7, 0.8, sfxBus, 'lowpass', 900);
      tone('sawtooth', 220, t, 0.6, 0.35, sfxBus, 40);
    },
  };

  function sfx(name) {
    if (!ensureContext() || ctx.state !== 'running') return;
    const fx = effects[name];
    if (fx) fx(ctx.currentTime + 0.01);
  }

  // ---------- Music ----------
  function scheduleStep(s, t) {
    // Bass on every other step
    if (s % 2 === 0) tone('triangle', BASS[s % BASS.length], t, STEP * 1.6, 0.5, musicBus);
    // Lead blip on every 4th step
    if (s % 4 === 2) tone('square', LEAD[(s >> 2) % LEAD.length], t, STEP * 1.2, 0.06, musicBus);
    // Kick on the downbeat of each bar
    if (s % 8 === 0) tone('sine', 120, t, 0.18, 0.9, musicBus, 40);
    // Hi-hat on the offbeats
    if (s % 2 === 1) noise(t, 0.04, 0.12, musicBus, 'highpass', 7000);
  }

  function scheduler() {
    if (!musicOn || !ctx) return;
    while (nextNoteTime < ctx.currentTime + 0.12) {
      scheduleStep(step, nextNoteTime);
      nextNoteTime += STEP;
      step++;
    }
  }

  function startMusic() {
    if (!ensureContext()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (musicOn) return;
    musicOn = true;
    step = 0;
    nextNoteTime = ctx.currentTime + 0.05;
    musicBus.gain.setTargetAtTime(0.22, ctx.currentTime, 0.1);
    timerId = setInterval(scheduler, 25);
  }

  function stopMusic() {
    musicOn = false;
    clearInterval(timerId);
    timerId = null;
  }

  // Lower the music volume while paused, without stopping the sequencer
  function duck(on) {
    if (!ctx) return;
    musicBus.gain.setTargetAtTime(on ? 0.05 : 0.22, ctx.currentTime, 0.1);
  }

  function toggleMute() {
    muted = !muted;
    if (ensureContext()) {
      master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.02);
    }
    return muted;
  }

  return { unlock, sfx, startMusic, stopMusic, duck, toggleMute };
})();
