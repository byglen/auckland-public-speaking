// screens.jsx — all screen components for Auckland Public Speaking app
const { useState, useEffect, useRef, useCallback } = React;

// ─── COLOUR TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg: '#0b0b14',
  surface: '#16162a',
  border: '#2a2a48',
  accent: '#2f72f8', // electric blue
  accentD: '#1a58d4',
  gold: '#d4a84b',
  dim: '#5060a0',
  text: '#f0f0f8',
  muted: '#9090c0',
  pulseRed: '#ff4040',
  pulseRedSoft: '#ff7878'
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmt(secs) {
  const m = Math.floor(Math.abs(secs) / 60);
  const s = Math.floor(Math.abs(secs) % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// A single soft bell tone (FM-like with two sine partials + slow decay)
function playChimeOnce(audioCtx, when = 0, baseFreq = 660, vol = 0.35) {
  const ctx = audioCtx;
  const t   = ctx.currentTime + when;

  // Master gain envelope
  const master = ctx.createGain();
  master.connect(ctx.destination);
  master.gain.setValueAtTime(0.0001, t);
  master.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);

  // Fundamental
  const o1 = ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = baseFreq;
  o1.connect(master);
  o1.start(t);
  o1.stop(t + 1.7);

  // Octave shimmer (softer)
  const g2 = ctx.createGain();
  g2.gain.value = 0.35;
  g2.connect(master);
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = baseFreq * 2;
  o2.connect(g2);
  o2.start(t);
  o2.stop(t + 1.4);

  // Major-third sparkle
  const g3 = ctx.createGain();
  g3.gain.value = 0.18;
  g3.connect(master);
  const o3 = ctx.createOscillator();
  o3.type = 'sine';
  o3.frequency.value = baseFreq * 2.5;
  o3.connect(g3);
  o3.start(t);
  o3.stop(t + 1.2);
}

// Play a one-off chime (or short sequence)
function playChime(notes = [660]) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    notes.forEach((f, i) => playChimeOnce(ctx, i * 0.18, f, 0.35));
  } catch (_) {}
}

// Start a looping chime — returns a stop() handle
function startLoopingChime(notes = [880, 660], intervalMs = 1800) {
  let ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (_) {
    return () => {};
  }
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    notes.forEach((f, i) => playChimeOnce(ctx, i * 0.22, f, 0.4));
  };
  tick();
  const id = setInterval(tick, intervalMs);
  return () => {
    stopped = true;
    clearInterval(id);
    setTimeout(() => { try { ctx.close(); } catch (_) {} }, 2000);
  };
}

// ─── SHARED BUTTON ────────────────────────────────────────────────────────────
function Btn({ children, onClick, variant = 'primary', size = 'md', disabled }) {
  const base = {
    fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: 14, border: 'none', fontWeight: 700,
    letterSpacing: '0.04em', transition: 'opacity 0.15s, transform 0.1s',
    opacity: disabled ? 0.35 : 1
  };
  const sizes = {
    sm: { padding: '0.65rem 1.5rem', fontSize: '1.05rem' },
    md: { padding: '1rem 2.5rem', fontSize: '1.3rem' },
    lg: { padding: '1.4rem 3.5rem', fontSize: '1.6rem' },
    xl: { padding: '1.8rem 5rem', fontSize: '2rem' }
  };
  const variants = {
    primary: { background: C.accent, color: '#fff' },
    gold: { background: C.gold, color: '#0b0b14' },
    outline: { background: 'transparent', color: C.accent, border: `2px solid ${C.accent}` },
    ghost: { background: 'transparent', color: C.dim, border: 'none' },
    surface: { background: C.surface, color: C.muted, border: `1.5px solid ${C.border}` }
  };
  return (
    <button onClick={disabled ? undefined : onClick}
    style={{ ...base, ...sizes[size], ...variants[variant] }}>
      {children}
    </button>);

}

// ─── SETUP SCREEN ─────────────────────────────────────────────────────────────
function SetupScreen({ onComplete }) {
  const [q, setQ] = useState('');
  const taRef = useRef(null);
  useEffect(() => {taRef.current?.focus();}, []);

  const pickRandom = () => {
    const pool = QUESTIONS.filter((x) => x !== q);
    setQ(pool[Math.floor(Math.random() * pool.length)]);
  };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 7rem', gap: '3rem' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: C.dim, fontSize: '1.1rem', letterSpacing: '0.35em', textTransform: 'uppercase', marginBottom: '1rem' }}>Auckland Public Speaking</div>
        <h1 style={{ color: C.text, fontSize: '4rem', fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>
          Set the Question of the Night
        </h1>
        <p style={{ color: C.muted, marginTop: '0.9rem', fontSize: '1.3rem' }}>This will be displayed on the home screen and offered as a speech option.</p>
      </div>

      <div style={{ width: '100%', maxWidth: 960 }}>
        <textarea
          ref={taRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type the question of the night…"
          rows={4}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: C.surface, border: `2px solid ${q ? C.accent + '80' : C.border}`,
            borderRadius: 18, padding: '1.75rem 2rem',
            color: C.text, fontSize: '1.85rem', fontFamily: 'inherit',
            resize: 'vertical', outline: 'none', lineHeight: 1.5,
            transition: 'border-color 0.2s'
          }} />
        
      </div>

      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
        <Btn variant="outline" size="md" onClick={pickRandom}>Pick a random question</Btn>
        <Btn variant="primary" size="lg" disabled={!q.trim()} onClick={() => q.trim() && onComplete(q.trim())}>
          Let's go →
        </Btn>
      </div>
    </div>);

}

// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
function HomeScreen({ questionOfNight, participants, onRegister, onDraw, onEditQuestion, onShowQR, onResetSpeakers, onLoadDemoSpeakers }) {
  const remaining = participants.filter((p) => !p.done);
  const total = participants.length;
  const done = participants.filter((p) => p.done).length;

  const handleReset = () => {
    if (done === 0) return;
    if (window.confirm(`Reset ${done} speaker${done === 1 ? '' : 's'} back into the draw?`)) {
      onResetSpeakers && onResetSpeakers();
    }
  };

  // Shift+D — load demo speakers for testing the wheel (ignored in text fields)
  useEffect(() => {
    if (!onLoadDemoSpeakers) return;
    const h = (e) => {
      if (!e.shiftKey || e.code !== 'KeyD') return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      onLoadDemoSpeakers();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onLoadDemoSpeakers]);

  // Listen for any letter key press → launch register screen with that char
  useEffect(() => {
    const h = (e) => {
      // Skip if modifier keys held, or if user is typing in an input already
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.shiftKey && e.code === 'KeyD') return;

      // Only single printable characters (letters/numbers/space chars are 1 char keys, but we exclude Space)
      if (e.key.length === 1 && /[a-zA-Z0-9'\-]/.test(e.key)) {
        e.preventDefault();
        onRegister(e.key);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onRegister]);

  return (
    <div style={{ background: C.bg, height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.75rem 3rem', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ color: C.dim, fontSize: '1rem', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600 }}>
          Auckland Public Speaking
        </div>
        <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
          {total > 0 &&
          <span style={{ color: C.dim, fontSize: '1rem', marginRight: '0.5rem' }}>
              {done}/{total} done
            </span>
          }
          <Btn variant="outline" size="sm" onClick={() => onRegister('')}>
            Add Speakers
          </Btn>
          {done > 0 &&
          <Btn variant="surface" size="sm" onClick={handleReset}>
              Reset Speakers
            </Btn>
          }
          <Btn variant="ghost" size="sm" onClick={onShowQR}>WhatsApp QR</Btn>

        </div>
      </div>

      {/* Centre */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 7rem', textAlign: 'center' }}>
        <div style={{ color: C.accent, fontSize: '1.15rem', letterSpacing: '0.35em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '2rem' }}>
          Question of the Night
        </div>
        <h1 style={{
          color: C.text, fontWeight: 900,

          lineHeight: 1.18, maxWidth: 1200,
          textWrap: 'pretty',
          marginBottom: '4rem', fontFamily: "Outfit", letterSpacing: "0.1px", fontSize: "120px"
        }}>
          {questionOfNight}
        </h1>

        {total === 0 &&
        <div style={{ color: C.muted, fontSize: '1.6rem' }}></div>
        }
        {total > 0 && remaining.length === 0 &&
        <div style={{ color: C.gold, fontSize: '2.8rem', fontWeight: 800 }}>All speakers done — great night!</div>
        }
      </div>

      {/* Speaker chips */}
      {total > 0 &&
      <div style={{ padding: '1.25rem 3rem', borderTop: `1px solid ${C.border}`, display: 'flex', flexWrap: 'wrap', gap: '0.65rem', justifyContent: 'center' }}>
          {participants.map((p) =>
        <span key={p.name} style={{
          padding: '0.4rem 1.1rem', borderRadius: 100,
          background: p.done ? `${C.dim}20` : `${C.accent}18`,
          color: p.done ? C.dim : C.muted,
          fontSize: '1rem',
          textDecoration: p.done ? 'line-through' : 'none'
        }}>
              {p.name}
            </span>
        )}
        </div>
      }
    </div>);

}

// ─── REGISTRATION SCREEN ──────────────────────────────────────────────────────
function RegistrationScreen({ initialChar = '', onAdd, onDone }) {
  const [name, setName] = useState(initialChar);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    // Move caret to end
    const el = inputRef.current;
    if (el) {
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, []);

  const submit = () => {
    const t = name.trim();
    if (t) onAdd(t);
    onDone();
  };

  return (
    <div style={{ background: C.bg, height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 6rem', gap: '3rem' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: C.dim, fontSize: '1.2rem', letterSpacing: '0.35em', textTransform: 'uppercase', marginBottom: '1rem' }}>Add Your Name</div>
        <p style={{ color: C.muted, fontSize: '1.6rem', marginTop: '0.5rem' }}>Type your name, then press <span style={{ color: C.text, fontWeight: 700 }}>Enter</span></p>
      </div>

      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
          if (e.key === 'Escape') { onDone(); }
        }}
        placeholder="Your name…"
        style={{
          width: '90%',
          maxWidth: 1500,
          background: 'transparent',
          border: 'none',
          borderBottom: `4px solid ${C.accent}`,
          padding: '1.5rem 1rem',
          color: C.text,
          fontSize: 'clamp(5rem, 11vw, 11rem)',
          fontFamily: 'inherit',
          fontWeight: 800,
          textAlign: 'center',
          letterSpacing: '-0.02em',
          outline: 'none',
          caretColor: C.accent
        }} />

      <div style={{ color: C.dim, fontSize: '1.1rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
        Press Esc to cancel
      </div>
    </div>);
}

// ─── QR CODE SCREEN ───────────────────────────────────────────────────────────
function QRScreen({ onBack }) {
  useEffect(() => {
    const h = (e) => {
      if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onBack]);

  return (
    <div style={{ background: C.bg, height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', position: 'relative' }}>
      <div style={{ color: '#25D366', fontSize: '1.4rem', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '1.5rem' }}>
        Join our WhatsApp
      </div>
      <h1 style={{ color: C.text, fontSize: '4rem', fontWeight: 900, margin: 0, marginBottom: '3rem', letterSpacing: '-0.02em', textAlign: 'center' }}>
        Scan to join the group
      </h1>

      <div style={{ background: '#fff', padding: '2.5rem', borderRadius: 28, boxShadow: '0 30px 80px rgba(0,0,0,0.4)' }}>
        <img src="whatsapp-qr.png" alt="WhatsApp group QR code" style={{ display: 'block', width: 520, height: 520, imageRendering: 'pixelated' }} />
      </div>

      <p style={{ color: C.muted, fontSize: '1.5rem', marginTop: '2.5rem', marginBottom: '2rem' }}>
        Open your camera and point it at the code
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
        <Btn variant="surface" size="md" onClick={onBack}>← Back to Home</Btn>
        <span style={{ color: C.dim, fontSize: '0.95rem' }}>Esc / Space / Enter to return</span>
      </div>
    </div>);
}

// ─── DRAWING SCREEN ───────────────────────────────────────────────────────────
function DrawingScreen({ participants, onComplete, onAddLate, onRemoveParticipant, onBackHome }) {
  const [phase, setPhase] = useState('ready');
  const [display, setDisplay] = useState('');
  const [winner, setWinner] = useState(null);
  const [nameKey, setNameKey] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [lateName, setLateName] = useState('');
  const lateInputRef = useRef(null);

  const remaining = participants.filter((p) => !p.done);

  useEffect(() => {
    if (showAdd) setTimeout(() => lateInputRef.current?.focus(), 60);
  }, [showAdd]);

  // Stop spacebar from triggering the draw while typing in late-speaker input
  const submitLate = () => {
    const t = lateName.trim();
    if (!t || participants.some((p) => p.name.toLowerCase() === t.toLowerCase())) {
      setLateName('');
      setShowAdd(false);
      return;
    }
    onAddLate(t);
    setLateName('');
    setShowAdd(false);
  };

  // Lock the participant pool for the spin so React state changes don't reshuffle the wheel mid-animation
  const [spinPool, setSpinPool] = useState([]);
  const [spinWinnerIdx, setSpinWinnerIdx] = useState(-1);
  const [spinKey, setSpinKey] = useState(0);

  const [spinFocusName, setSpinFocusName] = useState('');
  const [spinFocusKey, setSpinFocusKey] = useState(0);
  const spinPointerLastRef = useRef(null);

  const [spinSpaceHeld, setSpinSpaceHeld] = useState(false);

  useEffect(() => {
    if (phase !== 'spinning') setSpinSpaceHeld(false);
  }, [phase]);

  const onSpinBoostChange = useCallback((held) => {
    setSpinSpaceHeld(!!held);
  }, []);

  const onWheelPointerName = useCallback((name) => {
    if (name == null || name === '') return;
    if (spinPointerLastRef.current === name) return;
    spinPointerLastRef.current = name;
    setSpinFocusName(name);
    setSpinFocusKey((k) => k + 1);
  }, []);

  const launchSpinFromPool = useCallback((pool) => {
    if (pool.length === 0) return;
    setShowAdd(false);
    const winnerIdx = Math.floor(Math.random() * pool.length);
    const w = pool[winnerIdx];
    setSpinPool(pool);
    setSpinWinnerIdx(winnerIdx);
    setSpinKey((k) => k + 1);
    setWinner(w);
    setPhase('spinning');
    setSpinFocusName('');
    spinPointerLastRef.current = null;
  }, []);

  const startDraw = useCallback(() => {
    if (phase !== 'ready' || remaining.length === 0) return;
    launchSpinFromPool([...remaining]);
  }, [phase, remaining, launchSpinFromPool]);

  /** Same pool as Draw — nobody is marked done until they browse questions */
  const respinFromReveal = useCallback(() => {
    if (phase !== 'reveal' || remaining.length === 0) return;
    launchSpinFromPool([...remaining]);
  }, [phase, remaining, launchSpinFromPool]);

  const onSpinComplete = useCallback(() => {
    setNameKey((k) => k + 1);
    setPhase('reveal');
  }, []);

  // Block the global Space/Enter handler when typing a late name
  useEffect(() => {
    const h = (e) => {
      if (showAdd) return; // input has its own onKeyDown handler
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      e.preventDefault();
      if (phase === 'ready') startDraw();
      if (phase === 'reveal' && winner) onComplete(winner.name);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [phase, startDraw, winner, onComplete, showAdd]);

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      background: spinSpaceHeld
        ? `radial-gradient(ellipse 92% 88% at 50% 38%, rgba(255,64,64,0.22) 0%, #150508 42%, ${C.bg} 88%)`
        : C.bg,
      boxShadow: spinSpaceHeld ? 'inset 0 0 140px rgba(255,64,64,0.12)' : 'none',
      transition: 'background 0.42s cubic-bezier(0.25, 0.46, 0.45, 1), box-shadow 0.42s cubic-bezier(0.25, 0.46, 0.45, 1)'
    }}>

      {phase === 'spinning' && spinSpaceHeld &&
      <div
        aria-hidden
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          background: 'radial-gradient(circle at 50% -10%, rgba(255,64,64,0.18) 0%, transparent 48%)',
          animation: 'spinHoldPulse 2.4s ease-in-out infinite',
          opacity: 0.9
        }}
      />
      }

      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {/* Decorative rings (visible on Next Speaker) */}
      {phase === 'reveal' &&
      <>
        <div style={{ position: 'absolute', width: 800, height: 800, borderRadius: '50%', border: `1px solid ${C.accent}12`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 560, height: 560, borderRadius: '50%', border: `1px solid ${C.accent}18`, pointerEvents: 'none' }} />
      </>
      }

      {/* ── READY ── */}
      {phase === 'ready' &&
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0' }}>
          <div style={{ color: C.dim, fontSize: '1.15rem', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '2rem' }}>
            {remaining.length} speaker{remaining.length !== 1 ? 's' : ''} in the draw
          </div>

          {/* Participant chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', maxWidth: 1000, marginBottom: '3.5rem' }}>
            {remaining.map((p) =>
          <span key={p.name} style={{
            background: `${C.accent}16`, border: `1px solid ${C.accent}38`,
            color: C.muted, paddingLeft: '1.35rem', paddingRight: '0.5rem',
            paddingTop: '0.5rem', paddingBottom: '0.5rem',
            borderRadius: 100, fontSize: '1.3rem',
            display: 'inline-flex', alignItems: 'center', gap: '0.65rem'
          }}>
              {p.name}
              <button
                onClick={() => onRemoveParticipant && onRemoveParticipant(p.name)}
                title={`Remove ${p.name}`}
                aria-label={`Remove ${p.name}`}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: C.dim,
                  fontSize: '1.1rem',
                  width: 26, height: 26,
                  lineHeight: 1,
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0,
                  transition: 'background 0.12s, color 0.12s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#ff404020'; e.currentTarget.style.color = '#ff7878'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.dim; }}>
                ×
              </button>
            </span>
          )}
          </div>

          <Btn variant="primary" size="xl" onClick={startDraw} disabled={remaining.length === 0}>Draw!</Btn>
          <div style={{ color: C.dim, marginTop: '0.9rem', fontSize: '1.05rem' }}>or press Space / Enter</div>

          {/* Add late speaker / back home */}
          <div style={{ marginTop: '2.5rem', display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
            {!showAdd ?
          <>
              <Btn variant="surface" size="sm" onClick={() => setShowAdd(true)}>+ Add Late Speaker</Btn>
              <Btn variant="surface" size="sm" onClick={onBackHome}>← Back to Home</Btn>
            </> :

          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                <input
              ref={lateInputRef}
              value={lateName}
              onChange={(e) => setLateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  submitLate();
                }
                if (e.key === 'Escape') {
                  setShowAdd(false);
                  setLateName('');
                }
              }}
              placeholder="Name…"
              style={{
                background: C.surface, border: `1.5px solid ${C.accent}60`,
                borderRadius: 10, padding: '0.65rem 1.25rem',
                color: C.text, fontSize: '1.2rem', fontFamily: 'inherit',
                outline: 'none', width: 240
              }} />
            
                <Btn variant="primary" size="sm" onClick={submitLate}>Add</Btn>
                <Btn variant="ghost" size="sm" onClick={() => {setShowAdd(false);setLateName('');}}>Cancel</Btn>
              </div>
          }
          </div>
        </div>
      }

      {phase === 'spinning' && spinFocusName &&
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: 'clamp(1rem, 3vh, 2.5rem)',
          right: 'clamp(1rem, 3vw, 2.75rem)',
          maxWidth: 'min(58vw, 720px)',
          zIndex: 50,
          pointerEvents: 'none',
          textAlign: 'right'
        }}>
        <div
          key={spinFocusKey}
          style={{
            fontFamily: 'Outfit',
            fontSize: 'clamp(3rem, 6.2vw, 7rem)',
            fontWeight: 700,
            color: C.gold,
            lineHeight: 1.1,
            letterSpacing: '-0.1px',
            textShadow: '0 4px 32px rgba(0,0,0,0.55), 0 0 56px rgba(212,168,75,0.22)',
            animation: 'spinNameSwap 0.1s cubic-bezier(0.22, 1, 0.36, 1) both',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            willChange: 'transform, opacity'
          }}>
          {spinFocusName}
        </div>
      </div>
      }

      {/* ── SPINNING ── */}
      {phase === 'spinning' && spinPool.length > 0 && spinWinnerIdx >= 0 &&
      <div style={{
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        flex: 1,
        minHeight: 0,
        padding: 'clamp(0.35rem, 1.5vh, 1rem)',
        gap: 'clamp(0.55rem, 1.8vh, 1.35rem)'
      }}>
        {spinSpaceHeld &&
        <div
          style={{
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            fontSize: '0.72rem',
            fontWeight: 800,
            color: C.pulseRedSoft,
            display: 'flex',
            alignItems: 'center',
            gap: '0.55rem',
            animation: 'pulseBig 1.8s ease-in-out infinite'
          }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: C.pulseRed,
              boxShadow: `0 0 14px ${C.pulseRed}, 0 0 28px rgba(255,64,64,0.45)`
            }}
          />
          Full speed — release Space to land
        </div>
        }
        <div style={{
          flexShrink: 0,
          width: 'min(88vw, min(76vh, 920px))',
          transition:
            'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), filter 0.38s cubic-bezier(0.25, 0.46, 0.45, 1)',
          transform: spinSpaceHeld ? 'scale(1.035)' : 'scale(1)',
          filter: spinSpaceHeld
            ? 'saturate(1.1) brightness(1.04) drop-shadow(0 0 28px rgba(255,180,115,0.38)) drop-shadow(0 0 64px rgba(70,155,255,0.4)) drop-shadow(0 0 20px rgba(255,64,64,0.2))'
            : 'none'
        }}>
          {window.SpinWheel && React.createElement(window.SpinWheel, {
            names: spinPool.map((p) => p.name),
            winnerIdx: spinWinnerIdx,
            spinKey: spinKey,
            onComplete: onSpinComplete,
            onPointerNameChange: onWheelPointerName,
            onSpaceBoostChange: onSpinBoostChange
          })}
        </div>
        <div style={{
          color: spinSpaceHeld ? `${C.pulseRedSoft}e6` : `${C.dim}cc`,
          fontSize: '1.05rem',
          marginTop: '0.25rem',
          letterSpacing: '0.06em',
          textAlign: 'center',
          maxWidth: 560,
          lineHeight: 1.45,
          transition: 'color 0.3s ease'
        }}>
          {spinSpaceHeld ?
          <>
              Release <span style={{ color: C.text, fontWeight: 700 }}>Space</span> to stop
            </> :

          <>
              Hold <span style={{ color: C.text, fontWeight: 700 }}>Space</span> to spin
            </>
          }
        </div>
      </div>
      }

      {/* ── REVEAL (Next Speaker) — Space / Enter or button → question picker */}
      {phase === 'reveal' && winner &&
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: C.gold, fontSize: '1.3rem', letterSpacing: '0.35em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '2rem' }}>
          Next Speaker
        </div>
        <div key={nameKey} style={{
          fontSize: 'clamp(6rem, 14vw, 14rem)',
          fontWeight: 900, color: C.gold,
          letterSpacing: '-0.03em', lineHeight: 1,
          animation: 'revealBounce 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}>
          {winner.name}
        </div>
        <div style={{ marginTop: '3.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.7rem' }}>
          <Btn variant="gold" size="lg" onClick={() => onComplete(winner.name)}>Choose a Question →</Btn>
          <span style={{ color: C.dim, fontSize: '1rem' }}>or press Space / Enter</span>
          {remaining.length > 1 &&
          <button
            type="button"
            onClick={respinFromReveal}
            aria-label="Spin again — speaker stays in the pool until they choose a question"
            style={{
              marginTop: '1.75rem',
              background: 'none',
              border: 'none',
              color: `${C.dim}cc`,
              fontSize: '0.95rem',
              fontFamily: 'inherit',
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: '0.22em'
            }}>
            Spin again
          </button>
          }
        </div>
      </div>
      }

      </div>

    </div>);

}

// ─── QUESTION SELECT SCREEN ───────────────────────────────────────────────────
function QuestionSelectScreen({ speakerName, questionOfNight, usedQuestions, onStart }) {
  const [idx, setIdx] = useState(0);
  const [options, setOptions] = useState([]);
  const [qKey, setQKey] = useState(0);

  useEffect(() => {
    const available = QUESTIONS.filter((q) => !usedQuestions.has(q) && q !== questionOfNight);
    const shuffled = [...available].sort(() => Math.random() - 0.5).slice(0, 3);
    setOptions([questionOfNight, ...shuffled]);
    setIdx(0);
    setQKey((k) => k + 1);
  }, [speakerName]);

  const isQotN = idx === 0;
  const current = options[idx] || '';
  const qotNUsed = usedQuestions.has(questionOfNight);

  const goLeft = useCallback(() => {setIdx((i) => Math.max(0, i - 1));setQKey((k) => k + 1);}, []);
  const goRight = useCallback(() => {setIdx((i) => Math.min(options.length - 1, i + 1));setQKey((k) => k + 1);}, [options.length]);

  useEffect(() => {
    const h = (e) => {
      if (e.code === 'ArrowLeft') {e.preventDefault();goLeft();}
      if (e.code === 'ArrowRight') {e.preventDefault();goRight();}
      if (e.code === 'Space') {e.preventDefault();if (current) onStart(current);}
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [goLeft, goRight, current, onStart]);

  if (!options.length) return null;

  const questionSelectBackdrop = isQotN
    ? `radial-gradient(ellipse 125% 95% at 50% 28%, rgba(212,168,75,0.16) 0%, rgba(212,168,75,0.06) 42%, ${C.bg} 78%)`
    : `radial-gradient(ellipse 125% 95% at 50% 28%, rgba(47,114,248,0.14) 0%, rgba(47,114,248,0.05) 42%, ${C.bg} 78%)`;

  return (
    <div style={{
      background: questionSelectBackdrop,
      transition: 'background 0.5s ease',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 6rem',
      position: 'relative'
    }}>

      {/* Badge — fixed at top (Question of the Night vs random pool picks) */}
      {isQotN &&
      <div style={{ position: 'absolute', top: '2.5rem', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 2 }}>
        <span style={{
          background: `${C.gold}20`, border: `1.5px solid ${C.gold}55`,
          color: C.gold, borderRadius: 100, padding: '0.4rem 1.25rem',
          fontSize: '1rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
          display: 'inline-flex', alignItems: 'center', gap: '0.45rem'
        }}>
          <span style={{ fontSize: '1.05rem', lineHeight: 1 }} aria-hidden>★</span>
          Question of the Night
        </span>
      </div>
      }

      {!isQotN && current &&
      <div style={{ position: 'absolute', top: '2.5rem', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 2 }}>
        <span style={{
          background: `${C.accent}1a`, border: `1.5px solid ${C.accent}70`,
          color: C.accent, borderRadius: 100, padding: '0.4rem 1.25rem',
          fontSize: '1rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
          display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
          boxShadow: `0 0 28px ${C.accent}18`
        }}>
          <span style={{ fontSize: '1.1rem', lineHeight: 1 }} aria-hidden>🎲</span>
          Random question {idx}
        </span>
      </div>
      }

      {/* Question text — vertically centred between top and pagination (which sits at bottom: 3rem) */}
      <div key={qKey} style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: '11rem',  // leave room for pagination
        paddingTop: '6rem',  // leave room for badge
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 3rem 0',
        textAlign: 'center',
        color: C.text,
        textWrap: 'pretty',
        animation: 'fadeSlide 0.22s ease-out',
        fontFamily: "Outfit",
        fontWeight: "700",
        letterSpacing: "-0.1px",
        fontSize: "clamp(3rem, 6.2vw, 7rem)",
        lineHeight: "1.1"
      }}>
        <span style={{ maxWidth: 1500 }}>{current}</span>
      </div>

      {/* Nav (fixed to bottom centre) */}
      <div style={{ position: 'absolute', bottom: '3rem', left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2.25rem' }}>
        <button onClick={goLeft} disabled={idx === 0} style={{
          background: idx === 0 ? 'transparent' : C.surface,
          border: `1.5px solid ${idx === 0 ? C.border + '40' : C.border}`,
          color: idx === 0 ? C.border : C.text,
          width: 70, height: 70, borderRadius: 16,
          fontSize: '1.7rem', cursor: idx === 0 ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>←</button>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          {options.map((_, i) =>
          <div key={i} onClick={() => {setIdx(i);setQKey((k) => k + 1);}} style={{
            width: i === idx ? 32 : 10, height: 10, borderRadius: 100,
            background: i === idx ? i === 0 ? C.gold : C.accent : `${C.dim}50`,
            cursor: 'pointer', transition: 'all 0.25s'
          }} />
          )}
        </div>

        <button onClick={goRight} disabled={idx === options.length - 1} style={{
          background: idx === options.length - 1 ? 'transparent' : C.surface,
          border: `1.5px solid ${idx === options.length - 1 ? C.border + '40' : C.border}`,
          color: idx === options.length - 1 ? C.border : C.text,
          width: 70, height: 70, borderRadius: 16,
          fontSize: '1.7rem', cursor: idx === options.length - 1 ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>→</button>
      </div>
    </div>);

}

// ─── SPEECH SCREEN ────────────────────────────────────────────────────────────
function SpeechScreen({ speakerName, question, onComplete }) {
  const [phase, setPhase] = useState('speech');
  const [speechSecs, setSpeechSecs] = useState(0);
  const [feedSecs, setFeedSecs] = useState(0);
  const [flashOn, setFlashOn] = useState(false);
  const phaseRef = useRef('speech');
  phaseRef.current = phase;

  // Speech timer
  useEffect(() => {
    if (phase !== 'speech') return;
    const start = Date.now();
    let alarmFired = false;
    let id;
    const tick = () => {
      const e = (Date.now() - start) / 1000;
      setSpeechSecs(e);
      if (e >= 120 && !alarmFired) {alarmFired = true;}
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [phase]);

  // Feedback timer
  useEffect(() => {
    if (phase !== 'feedback') return;
    const start = Date.now();
    let alarmFired = false;
    let id;
    const tick = () => {
      const e = (Date.now() - start) / 1000;
      setFeedSecs(e);
      if (e >= 120 && !alarmFired) {
        alarmFired = true;
        setPhase('alarm');
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [phase]);

  // Looping chime when speech runs over 2:00
  useEffect(() => {
    if (phase !== 'speech' || speechSecs < 120) return;
    const stop = startLoopingChime([880, 660], 1800);
    return stop;
  }, [phase, speechSecs >= 120]);

  // Looping chime when feedback runs out (alarm phase)
  useEffect(() => {
    if (phase !== 'alarm') return;
    const stop = startLoopingChime([784, 587], 1800);
    return stop;
  }, [phase]);

  // Over-time flash
  useEffect(() => {
    if (phase !== 'speech' || speechSecs < 120) return;
    const id = setInterval(() => setFlashOn((f) => !f), 500);
    return () => clearInterval(id);
  }, [phase, speechSecs >= 120]);

  // Key handler — Space advances state machine
  useEffect(() => {
    const h = (e) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      const p = phaseRef.current;
      if (p === 'speech') {setPhase('feedback');setFeedSecs(0);} else
      if (p === 'feedback') {onComplete();} // manual skip → straight to draw
      else if (p === 'alarm') {onComplete();} // timeout alarm → draw
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onComplete]);

  // ── derive visuals ──
  let bgColor = C.bg;
  if (phase === 'speech') {
    if (speechSecs >= 120) bgColor = flashOn ? '#4d0000' : '#280000';else
    if (speechSecs >= 90) bgColor = '#280a00';else
    if (speechSecs >= 60) bgColor = '#1c1000';
  } else if (phase === 'feedback') {
    bgColor = '#090d1a';
  } else if (phase === 'alarm') {
    bgColor = '#1a0000';
  }

  let timerColor = C.text;
  if (phase === 'speech') {
    if (speechSecs >= 120) timerColor = '#ff5050';else
    if (speechSecs >= 90) timerColor = '#ff7030';else
    if (speechSecs >= 60) timerColor = '#ffb040';
  }

  const feedLeft = Math.max(0, 120 - feedSecs);

  return (
    <div style={{
      background: bgColor, height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      transition: 'background 1.2s ease', overflow: 'hidden', position: 'relative'
    }}>

      {/* ── ALARM ── */}
      {phase === 'alarm' &&
      <div style={{ textAlign: 'center', padding: '4rem' }}>
          <div style={{
          fontSize: 'clamp(4rem, 10vw, 9rem)',
          fontWeight: 900, color: '#ff4040',
          letterSpacing: '-0.02em', lineHeight: 1.1,
          animation: 'pulseBig 0.9s ease-in-out infinite'
        }}>
            Next Speaker, Please!
          </div>
          <div style={{ color: C.dim, marginTop: '2.5rem', fontSize: '1.3rem' }}>Press Space to continue</div>
          <div style={{ marginTop: '1.5rem' }}>
            <Btn variant="surface" size="md" onClick={onComplete}>Continue →</Btn>
          </div>
        </div>
      }

      {/* ── SPEECH + FEEDBACK ── */}
      {phase !== 'alarm' &&
      <>
          {/* Info bar */}
          <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          padding: '1.75rem 3rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          borderBottom: `1px solid ${phase === 'feedback' ? '#1a2a4a' : C.border}`
        }}>
            <div style={{ maxWidth: '68%' }}>
              <div style={{
              color: phase === 'feedback' ? '#5080d0' : C.accent,
              fontSize: '0.95rem', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 700
            }}>
                {phase === 'speech' ? `${speakerName} — Speaking` : `${speakerName} — Feedback`}
              </div>
              <div style={{ color: C.muted, fontSize: '1.85rem', marginTop: '0.5rem', lineHeight: 1.35, fontWeight: 600 }}>
                {question}
              </div>
            </div>
            <div style={{ textAlign: 'right', color: C.dim, fontSize: '0.95rem', lineHeight: 1.9 }}>
              {phase === 'speech' ? 'Speech time' : 'Feedback time'}
              <br /><span style={{ fontSize: '0.85rem' }}>Space to {phase === 'speech' ? 'end speech' : 'finish'}</span>
            </div>
          </div>

          {/* Timer */}
          <div style={{ textAlign: 'center' }}>
            {phase === 'speech' &&
          <>
                <div style={{
              fontSize: 'clamp(10rem, 24vw, 26rem)',
              fontWeight: 900, color: timerColor,
              letterSpacing: '-0.05em', lineHeight: 0.9,
              fontVariantNumeric: 'tabular-nums',
              transition: 'color 0.8s ease', userSelect: 'none'
            }}>
                  {fmt(speechSecs)}
                </div>
                {speechSecs >= 60 && speechSecs < 90 &&
            <div style={{ color: '#ffb040', fontSize: '2.2rem', fontWeight: 700, marginTop: '1.5rem', letterSpacing: '0.08em' }}>
                    ONE MINUTE
                  </div>
            }
                {speechSecs >= 90 && speechSecs < 120 &&
            <div style={{ color: '#ff7030', fontSize: '2.2rem', fontWeight: 700, marginTop: '1.5rem', letterSpacing: '0.08em' }}>
                    WRAP IT UP SOON
                  </div>
            }
                {speechSecs >= 120 &&
            <div style={{ color: '#ff5050', fontSize: '2.5rem', fontWeight: 800, marginTop: '1.5rem', letterSpacing: '0.08em', animation: 'pulseBig 0.9s ease-in-out infinite' }}>
                    TIME'S UP
                  </div>
            }
              </>
          }

            {phase === 'feedback' &&
          <>
                <div style={{ color: '#5080d0', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Feedback
                </div>
                <div style={{
              fontSize: 'clamp(10rem, 24vw, 26rem)',
              fontWeight: 900,
              color: feedLeft < 30 ? '#ff8060' : '#4a78d8',
              letterSpacing: '-0.05em', lineHeight: 0.9,
              fontVariantNumeric: 'tabular-nums',
              transition: 'color 0.8s ease', userSelect: 'none'
            }}>
                  {fmt(feedLeft)}
                </div>
                {feedLeft < 30 &&
            <div style={{ color: '#ff8060', fontSize: '2.2rem', fontWeight: 700, marginTop: '1.5rem', letterSpacing: '0.08em' }}>
                    ALMOST DONE
                  </div>
            }
              </>
          }
          </div>

          {/* Bottom-right end button */}
          <div style={{ position: 'absolute', bottom: '2.25rem', right: '3rem' }}>
            <Btn variant="surface" size="sm" onClick={() => {
            if (phase === 'speech') {setPhase('feedback');setFeedSecs(0);} else
            if (phase === 'feedback') {onComplete();}
          }}>
              {phase === 'speech' ? 'End Speech' : 'End Feedback'}
            </Btn>
          </div>
        </>
      }
    </div>);

}

// ─── EXPORT ───────────────────────────────────────────────────────────────────
Object.assign(window, {
  SetupScreen,
  HomeScreen,
  RegistrationScreen,
  DrawingScreen,
  QuestionSelectScreen,
  SpeechScreen,
  QRScreen
});