// Proste efekty dzwiekowe syntetyzowane na biezaco (Web Audio API) - bez plikow audio.

let ctx = null;

function getCtx() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioCtx();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/** Wywolywane przy kazdym nacisnieciu klawisza - przegladarki wymagaja gestu
 * uzytkownika, zeby odblokowac odtwarzanie dzwieku. */
export function unlock() {
  getCtx();
}

function envelope(gainNode, now, attack, decay, peak) {
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(peak, now + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + attack + decay);
}

function tone({ freqStart, freqEnd, duration, type = "square", peak = 0.2, delay = 0, output = null }) {
  const audio = getCtx();
  const now = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, now);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), now + duration);
  }
  envelope(gain, now, 0.005, duration, peak);
  osc.connect(gain).connect(output || audio.destination);
  osc.start(now);
  osc.stop(now + duration + 0.05);
}

function noiseBurst({ duration, peak = 0.3, filterFreq = 1200, delay = 0 }) {
  const audio = getCtx();
  const now = audio.currentTime + delay;
  const bufferSize = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const src = audio.createBufferSource();
  src.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(peak, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  src.connect(filter).connect(gain).connect(audio.destination);
  src.start(now);
}

/** Poslizg pchnietego bloku po lodzie. */
export function playPush() {
  tone({ freqStart: 380, freqEnd: 170, duration: 0.12, type: "triangle", peak: 0.16 });
}

/** Trzask rozbijanego bloku lodu (Spacja/E). */
export function playSmash() {
  noiseBurst({ duration: 0.15, peak: 0.35, filterFreq: 2200 });
  tone({ freqStart: 900, freqEnd: 500, duration: 0.06, type: "square", peak: 0.12, delay: 0.01 });
}

/** Zmiazdzenie wroga blokiem - wyzszy ton przy kolejnych trafieniach w combo. */
export function playCrush(combo = 1) {
  const base = 260 + (combo - 1) * 90;
  tone({ freqStart: base, freqEnd: base * 2.2, duration: 0.14, type: "sawtooth", peak: 0.22 });
}

/** Trzy diamenty w linii - dluzsze, blyszczace arpeggio. */
export function playDiamondBonus() {
  [784, 988, 1175, 1568, 1175, 1568].forEach((f, i) => {
    tone({ freqStart: f, duration: 0.1, type: "triangle", peak: 0.22, delay: i * 0.07 });
  });
}

// melodyjka grana w kolko podczas ogluszenia wrogow (nuty w Hz)
const STUN_TUNE = [1047, 1319, 1568, 1319, 1175, 1397, 1760, 1397];
const STUN_WARNING_MS = 2000; // koncowka ogluszenia - szybciej i wyzej, jako ostrzezenie

/**
 * Gra melodyjke przez durationMs (po opoznieniu delayMs). Zwraca funkcje, ktora ja
 * wycisza przed czasem (np. utrata zycia, koniec poziomu).
 */
export function startStunMusic(durationMs, delayMs = 0) {
  const audio = getCtx();
  const master = audio.createGain();
  master.gain.value = 1;
  master.connect(audio.destination);

  // cala melodyjka jest planowana od razu - kilkadziesiat krotkich nut to dla Web Audio drobiazg
  const startAt = delayMs / 1000;
  const endAt = startAt + durationMs / 1000;
  const warnAt = endAt - STUN_WARNING_MS / 1000;
  let t = startAt;
  let i = 0;
  while (t < endAt) {
    const warning = t >= warnAt;
    const freq = STUN_TUNE[i % STUN_TUNE.length] * (warning ? 1.5 : 1);
    tone({ freqStart: freq, duration: warning ? 0.06 : 0.09, type: "square", peak: 0.07, delay: t, output: master });
    t += warning ? 0.085 : 0.14;
    i++;
  }

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    const now = audio.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + 0.05);
    setTimeout(() => master.disconnect(), 100);
  };
}

/** Uderzenie w zewnetrzna sciane - niski, drgajacy brzek. */
export function playWallShake() {
  tone({ freqStart: 140, freqEnd: 90, duration: 0.28, type: "square", peak: 0.16 });
  tone({ freqStart: 147, freqEnd: 95, duration: 0.28, type: "square", peak: 0.1, delay: 0.02 });
}

/** Zabicie ogluszonego wroga przez wejscie na niego. */
export function playStunnedKill() {
  tone({ freqStart: 700, freqEnd: 1400, duration: 0.1, type: "square", peak: 0.18 });
  tone({ freqStart: 1050, freqEnd: 2100, duration: 0.1, type: "square", peak: 0.12, delay: 0.07 });
}

/** Utrata zycia (dotkniecie wroga). */
export function playHit() {
  tone({ freqStart: 300, freqEnd: 60, duration: 0.35, type: "sawtooth", peak: 0.25 });
}

/** Ukonczenie poziomu - wesoly, wznoszacy sie arpeggio. */
export function playLevelComplete() {
  [523, 659, 784, 1047].forEach((f, i) => {
    tone({ freqStart: f, duration: 0.12, type: "square", peak: 0.2, delay: i * 0.09 });
  });
}

/** Koniec gry - opadajacy, ponury motyw. */
export function playGameOver() {
  [400, 320, 240, 160].forEach((f, i) => {
    tone({ freqStart: f, duration: 0.22, type: "sawtooth", peak: 0.22, delay: i * 0.15 });
  });
}
