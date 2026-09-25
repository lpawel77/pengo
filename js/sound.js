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

function tone({ freqStart, freqEnd, duration, type = "square", peak = 0.2, delay = 0 }) {
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
  osc.connect(gain).connect(audio.destination);
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
