// jazz-loop.js — looping smooth jazz bed (Web Audio)

function startJazzLoop() {
  let ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (_) {
    return { stop() {}, ensurePlaying() { return Promise.resolve(); } };
  }

  let stopped = false;
  let schedulerId = null;
  let nextBarTime = 0;
  let barIndex = 0;

  const BPM = 84;
  const beat = 60 / BPM;

  // ii–V–I in Bb — classic lounge progression
  const CHORDS = [
    { notes: [60, 63, 67, 70], bass: [36, 38, 39, 41] },
    { notes: [65, 69, 72, 75], bass: [41, 43, 45, 46] },
    { notes: [70, 74, 77, 81], bass: [46, 48, 50, 51] },
    { notes: [70, 74, 77, 80], bass: [46, 47, 48, 50] }
  ];

  const master = ctx.createGain();
  master.gain.value = 0.0001;

  const warmth = ctx.createBiquadFilter();
  warmth.type = 'lowpass';
  warmth.frequency.value = 3600;
  warmth.Q.value = 0.6;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -22;
  comp.ratio.value = 2.8;
  comp.attack.value = 0.012;
  comp.release.value = 0.22;

  warmth.connect(comp);
  comp.connect(master);
  master.connect(ctx.destination);

  const bassBus = ctx.createGain();
  bassBus.gain.value = 0.52;
  bassBus.connect(warmth);

  const keysBus = ctx.createGain();
  keysBus.gain.value = 0.4;
  keysBus.connect(warmth);

  const drumBus = ctx.createGain();
  drumBus.gain.value = 0.16;
  drumBus.connect(warmth);

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  function scheduleBassNote(dest, freq, start, dur) {
    const g = ctx.createGain();
    g.connect(dest);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.55, start + 0.025);
    g.gain.setValueAtTime(0.42, start + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.connect(g);

    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    o.connect(lp);
    o.start(start);
    o.stop(start + dur + 0.04);
  }

  function scheduleRhodes(dest, notes, start, dur, vol) {
    notes.forEach((n, i) => {
      const t = start + i * 0.016;
      const g = ctx.createGain();
      g.connect(dest);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      const o1 = ctx.createOscillator();
      o1.type = 'sine';
      o1.frequency.value = midiToFreq(n);
      o1.connect(g);
      o1.start(t);
      o1.stop(t + dur + 0.06);

      const g2 = ctx.createGain();
      g2.gain.value = 0.32;
      g2.connect(g);
      const o2 = ctx.createOscillator();
      o2.type = 'triangle';
      o2.frequency.value = midiToFreq(n) * 1.0025;
      o2.connect(g2);
      o2.start(t);
      o2.stop(t + dur + 0.06);
    });
  }

  function scheduleBrush(dest, start, vol) {
    const len = Math.floor(ctx.sampleRate * 0.07);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.8);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2800 + Math.random() * 600;
    bp.Q.value = 0.75;

    const g = ctx.createGain();
    src.connect(bp);
    bp.connect(g);
    g.connect(dest);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.08);
    src.start(start);
  }

  function scheduleBar(time, chord) {
    chord.bass.forEach((n, i) => {
      scheduleBassNote(bassBus, midiToFreq(n), time + i * beat, beat * 0.9);
    });
    scheduleRhodes(keysBus, chord.notes, time, beat * 1.85, 0.48);
    scheduleRhodes(keysBus, chord.notes, time + beat * 2, beat * 1.85, 0.34);
    scheduleBrush(drumBus, time + beat, 0.32);
    scheduleBrush(drumBus, time + beat * 3, 0.26);
    scheduleBrush(drumBus, time + beat * 0.5, 0.1);
    scheduleBrush(drumBus, time + beat * 1.5, 0.09);
    scheduleBrush(drumBus, time + beat * 2.5, 0.09);
    scheduleBrush(drumBus, time + beat * 3.5, 0.09);
  }

  function scheduler() {
    if (stopped) return;
    const lookAhead = 0.1;
    const scheduleAhead = 0.28;
    while (nextBarTime < ctx.currentTime + scheduleAhead) {
      scheduleBar(nextBarTime, CHORDS[barIndex % CHORDS.length]);
      barIndex++;
      nextBarTime += beat * 4;
    }
    schedulerId = setTimeout(scheduler, lookAhead * 1000);
  }

  async function ensurePlaying() {
    if (stopped) return;
    if (ctx.state === 'suspended') await ctx.resume();
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    clearTimeout(schedulerId);
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
    master.gain.linearRampToValueAtTime(0.0001, t + 0.85);
    setTimeout(() => { try { ctx.close(); } catch (_) {} }, 1000);
  }

  const t0 = ctx.currentTime;
  master.gain.linearRampToValueAtTime(0.3, t0 + 1.2);
  nextBarTime = t0 + 0.04;
  scheduler();

  return { stop, ensurePlaying };
}
