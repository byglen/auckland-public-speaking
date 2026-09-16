// screens.jsx — all screen components for Auckland Public Speaking app
const { useState, useEffect, useRef, useCallback } = React;

// ─── OS-AGNOSTIC SHORTCUTS ────────────────────────────────────────────────────
// Mac uses ⌘; Windows/Linux use Ctrl. Detect once and expose helpers globally so
// both screens.jsx and app.jsx can describe + handle shortcuts correctly.
const IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');
const cmdPressed = (e) => (IS_MAC ? e.metaKey : e.ctrlKey);
const kbd = (letter) => (IS_MAC ? `\u2318${letter}` : `Ctrl+${letter}`);
window.IS_MAC = IS_MAC;
window.cmdPressed = cmdPressed;
window.kbd = kbd;

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
// One dark room (cool ink #101114, from Glen's Paper "aps typography style
// guide"), plain white stage type, chrome tinted with powder blue at low alpha.
// Sky blue is the badge/accent for the prompt of the night; vermilion stays
// reserved for heat (hat band, TIME'S UP, Yolo). Stage type is Canela Deck
// Bold — open tracking (+0.015em), generous leading — chrome is Theinhardt.
const FIELD = {
  blue: '#CDE4FE',       // powder blue — tints every hairline and muted label
  sky: '#5696D2',        // filled badges (prompt of the night, feedback)
  cobalt: '#2F4FD6',
  vermilion: '#E94F2E',
  caramel: '#C2874C',
  cream: '#FFFFFF',      // stage text is plain white now (legacy key name kept)
  chalk: '#E9F1FC',      // wordmark
  ink: '#101114'
};

const C = {
  bg: FIELD.ink,
  surface: '#171A20',
  border: 'rgba(205,228,254,0.22)',    // hairline
  borderSoft: 'rgba(205,228,254,0.12)', // quieter hairline
  gold: FIELD.vermilion,               // heat accent (legacy key name)
  goldBright: '#FF6A47',
  goldDim: 'rgba(233,79,46,0.5)',
  dim: 'rgba(205,228,254,0.45)',
  text: '#FFFFFF',
  muted: 'rgba(205,228,254,0.70)',
  cream: '#FFFFFF',
  chalk: FIELD.chalk,
  blue: FIELD.blue,
  blueDeep: FIELD.blue,
  sky: FIELD.sky,
  olive: '#4A5524',
  caramel: FIELD.caramel,
  amber: '#D9A24A',
  orange: '#E07A3A',
  pulseRed: '#C93A1B',
  pulseRedSoft: '#E94F2E',
  feedback: FIELD.sky,
  yolo: FIELD.ink
};

// Two voices: Canela Deck for the stage (prompts, names), Theinhardt for the
// machine (labels, badges, timers, buttons, hints). Neue Montreal is the
// wordmark only.
const F = {
  stage: "'Canela Deck', Georgia, 'Times New Roman', serif",
  ui: "'Theinhardt', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  brand: "'Neue Montreal', 'Theinhardt', 'Helvetica Neue', Helvetica, Arial, sans-serif"
};

/** Small-caps label — the only treatment for eyebrows/labels. No pills, no borders. */
function Eyebrow({ children, color = C.muted, large = false, tracking = '0.22em', style = {} }) {
  return (
    <span style={{
      fontFamily: F.ui,
      fontWeight: 700,
      fontSize: large ? '1.22rem' : '0.88rem',
      letterSpacing: tracking,
      paddingLeft: tracking, // optically recentre tracked uppercase
      textTransform: 'uppercase',
      color,
      ...style
    }}>
      {children}
    </span>
  );
}

/** Sentinel for the Yolo carousel slot (not a real question string). */
const YOLO_SLOT = '__YOLO_SLOT__';

/** WhatsApp group invite link. The QR on the end-of-night screen is generated
 *  from this string in the browser (qrcode.js), so it can never expire on its
 *  own. If an admin ever resets the group link in WhatsApp (Group info →
 *  Invite via link → Reset link), paste the new one here. Keep it bare — no
 *  ?s=sh&p=i… tracking suffix — so the code stays small and easy to scan. */
const WHATSAPP_INVITE_URL = 'https://chat.whatsapp.com/Cuwr1jL6MczHeoRG1xG1hI';

/** Bank transfer details shown at the end of the night — edit these to go live. */
const BANK_DETAILS = {
  accountName: 'Glen Oakes',
  accountNumber: '12-3140-0328925-00',
  reference: 'APS'
};

/** Format an account number for display. Pre-formatted numbers (with separators)
 *  are shown as-is; a bare digit string is grouped into blocks for legibility. */
function groupDigits(num, size = 4) {
  const raw = String(num).trim();
  if (/[^0-9]/.test(raw)) return raw;
  return raw.replace(new RegExp(`(.{${size}})`, 'g'), '$1 ').trim();
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmt(secs) {
  const m = Math.floor(Math.abs(secs) / 60);
  const s = Math.floor(Math.abs(secs) % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Whether a prompt reads as a question — i.e. it contains a question mark. Lets
 *  the UI say "question" for actual questions and "prompt" for open-ended story
 *  starters like "In a galaxy far, far away…". */
function isQuestionPrompt(text) {
  return typeof text === 'string' && text.includes('?');
}

/** The noun for a given prompt in UI copy: "question" when it contains a "?",
 *  otherwise "prompt". Pass { cap: true } to capitalise the first letter. */
function promptNoun(text, { cap = false } = {}) {
  const word = isQuestionPrompt(text) ? 'question' : 'prompt';
  return cap ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}
window.isQuestionPrompt = isQuestionPrompt;
window.promptNoun = promptNoun;

/** Pick a draw winner; first-timers excluded from draws 1–2 unless no one else is eligible. */
function pickDrawWinner(pool, spokenCount) {
  if (!pool.length) return { winner: null, winnerIdx: -1 };
  let eligible = pool;
  if (spokenCount < 2) {
    const regular = pool.filter((p) => !p.firstTimer);
    if (regular.length > 0) eligible = regular;
  }
  const pick = eligible[Math.floor(Math.random() * eligible.length)];
  const winnerIdx = pool.findIndex((p) => p.name === pick.name);
  return { winner: pick, winnerIdx };
}

/** Smoothly ramp a numeric display value (e.g. timer fast-forward in demo mode). */
function animateSecs(from, to, durationMs, onFrame, onDone) {
  const start = performance.now();
  let raf;
  const step = (now) => {
    const t = Math.min(1, (now - start) / durationMs);
    const eased = 1 - Math.pow(1 - t, 2.2);
    const v = from + (to - from) * eased;
    onFrame(v);
    if (t < 1) raf = requestAnimationFrame(step);
    else {
      onFrame(to);
      onDone && onDone();
    }
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

/** Looping smooth jazz — returns a stop() handle */
function startJazzAlarmLoop() {
  if (typeof startJazzLoop !== 'function') return () => {};
  const jazz = startJazzLoop();
  jazz.ensurePlaying().catch(() => {});
  return () => jazz.stop();
}

/** Swallow mouse / touch / trackpad input — keyboard still works (demo & question select). */
function useBlockPointerInput(active) {
  useEffect(() => {
    if (!active) return undefined;
    const block = (e) => {
      if (e.target?.closest?.('[data-walkthrough-ui]')) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const opts = { capture: true, passive: false };
    const events = [
      'mousedown', 'mouseup', 'click', 'dblclick',
      'touchstart', 'touchend', 'touchmove',
      'pointerdown', 'pointerup', 'contextmenu', 'wheel'
    ];
    events.forEach((ev) => document.addEventListener(ev, block, opts));
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      events.forEach((ev) => document.removeEventListener(ev, block, opts));
      document.body.style.overflow = prevOverflow;
    };
  }, [active]);
}

// ─── SHARED BUTTON ────────────────────────────────────────────────────────────
function Btn({ children, onClick, variant = 'primary', size = 'md', disabled }) {
  const base = {
    fontFamily: F.ui, cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: 12, border: '1px solid transparent', fontWeight: 500,
    letterSpacing: '0.01em', transition: 'opacity 0.15s, transform 0.1s',
    opacity: disabled ? 0.35 : 1
  };
  const sizes = {
    sm: { padding: '0.6rem 1.4rem', fontSize: '1rem' },
    md: { padding: '0.95rem 2.3rem', fontSize: '1.15rem' },
    lg: { padding: '1.3rem 3.2rem', fontSize: '1.4rem' },
    xl: { padding: '1.7rem 4.5rem', fontSize: '1.7rem' }
  };
  const variants = {
    primary: { background: C.surface, color: C.text, border: `1px solid ${C.border}` },
    gold: { background: C.surface, color: C.text, border: `1px solid ${C.border}` },
    outline: { background: 'transparent', color: C.muted, border: `1px solid ${C.border}` },
    ghost: { background: 'transparent', color: C.dim, border: '1px solid transparent' },
    surface: { background: 'transparent', color: C.muted, border: `1px solid ${C.border}` }
  };
  return (
    <button onClick={disabled ? undefined : onClick}
    style={{ ...base, ...sizes[size], ...variants[variant] }}>
      {children}
    </button>);

}

// ─── SHARED BRAND ─────────────────────────────────────────────────────────────
/** Pill badge — the label treatment for what a card *is*. `sky` (filled blue)
 *  for the prompt of the night and feedback, `heat` for Yolo, `quiet` (outlined)
 *  for the random prompts. Tracked caps in Theinhardt Bold, as in the style guide. */
function Badge({ children, tone = 'sky', large = false, style = {} }) {
  const tones = {
    sky: { background: FIELD.sky, color: '#FFFFFF', border: '1px solid transparent' },
    heat: { background: FIELD.vermilion, color: '#FFFFFF', border: '1px solid transparent' },
    quiet: { background: 'transparent', color: 'rgba(205,228,254,0.82)', border: '1px solid rgba(205,228,254,0.32)' }
  };
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      padding: large ? '0.68rem 1.28rem' : '0.6rem 1.06rem',
      paddingRight: large ? 'calc(1.28rem - 0.1em)' : 'calc(1.06rem - 0.1em)', // trailing tracking
      fontFamily: F.ui,
      fontWeight: 500,
      fontSize: large ? 'clamp(0.85rem, 1.06vw, 1.06rem)' : 'clamp(0.77rem, 0.94vw, 0.94rem)',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      lineHeight: 1.25,
      whiteSpace: 'nowrap',
      ...tones[tone],
      ...style
    }}>
      {children}
    </span>
  );
}

/** Yolo: the lights go red. A deep blood-red ground with an ember underneath
 *  and a glow that breathes slowly. Shared by the Yolo slot in the prompt
 *  picker and the Yolo prep / countdown screen — where it holds perfectly
 *  still, so the speaker's five seconds of thinking have nothing moving. */
const YOLO_BACKDROP = 'radial-gradient(ellipse 100% 62% at 50% 112%, rgba(233,79,46,0.34) 0%, rgba(180,30,30,0.12) 45%, transparent 72%), linear-gradient(180deg, #1F0507 0%, #150306 55%, #0B0203 100%)';

function YoloGlow({ still = false }) {
  return (
    <>
      <div aria-hidden style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse 72% 58% at 50% 58%, rgba(233,79,46,0.22) 0%, rgba(160,20,24,0.10) 45%, transparent 76%)',
        opacity: still ? 0.6 : undefined,
        animation: still ? 'none' : 'yoloBreathe 3.2s ease-in-out infinite'
      }} />
      <div aria-hidden style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)'
      }} />
    </>
  );
}

function QuestionOfNightBadge({ large = false, text = '' }) {
  return (
    <Badge tone="sky" large={large}>
      {promptNoun(text, { cap: true })} of the Night
    </Badge>
  );
}

function YoloModeBadge({ large = false }) {
  return (
    <Badge tone="heat" large={large}>
      Yolo mode
    </Badge>
  );
}

function FeedbackBadge({ large = false }) {
  return (
    <Badge tone="sky" large={large}>
      Feedback
    </Badge>
  );
}

function QuestionDisplayText({ children, style = {} }) {
  return (
    <div style={{
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      color: C.text,
      textWrap: 'balance',
      fontFamily: F.stage,
      fontWeight: 700,
      letterSpacing: '0.015em',
      fontSize: 'clamp(3rem, 6.1vw, 7rem)',
      lineHeight: 1.22,
      ...style
    }}>
      <span style={{ maxWidth: 'min(1280px, 100%)' }}>{children}</span>
    </div>
  );
}

// `locked` keeps the disabled look but leaves the button clickable so the walk-through
// can intercept the press and shake the coach card instead of silently doing nothing.
function HomeSubduedButton({ children, onClick, ariaLabel, disabled = false, locked = false }) {
  const muted = disabled || locked;
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'transparent',
        border: `1px solid ${C.border}`,
        color: C.muted,
        padding: '0.5rem 1rem',
        borderRadius: 10,
        cursor: muted ? 'not-allowed' : 'pointer',
        fontSize: '0.95rem',
        fontWeight: 500,
        fontFamily: F.ui,
        letterSpacing: '0.02em',
        opacity: muted ? 0.32 : 0.9
      }}>
      {children}
    </button>
  );
}

function HomeIconButton({ ariaLabel, onClick, children, disabled = false, locked = false }) {
  const muted = disabled || locked;
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'transparent',
        border: `1px solid ${C.border}`,
        color: C.muted,
        padding: '0.48rem 0.6rem',
        borderRadius: 10,
        cursor: muted ? 'not-allowed' : 'pointer',
        fontFamily: F.ui,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: muted ? 0.32 : 0.9,
        lineHeight: 0
      }}>
      {children}
    </button>
  );
}

function QrCodeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path fill="currentColor" d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm11 0h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm4 0h2v4h-2v-4zm-4 4h2v2h2v-2h-2z" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HomeBrandMark() {
  return (
    <div
      aria-label="Auckland Public Speaking"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        fontFamily: F.brand,
        fontSize: '0.95rem',
        lineHeight: 1.2,
        letterSpacing: '0.02em',
        color: C.chalk,
        whiteSpace: 'nowrap'
      }}>
      <span style={{ fontWeight: 500 }}>Auckland</span>
      <span style={{ fontWeight: 700 }}>Public Speaking</span>
    </div>
  );
}

// ─── SETUP SCREEN ─────────────────────────────────────────────────────────────
function SetupScreen({ onComplete, hideBrand = false, donePrompts = new Set() }) {
  const [q, setQ] = useState('');
  const [usedRandom, setUsedRandom] = useState(false);
  const taRef = useRef(null);
  const canSubmit = !!q.trim();

  useEffect(() => { taRef.current?.focus(); }, []);

  useEffect(() => {
    const h = (e) => {
      if (e.code !== 'Enter' || e.shiftKey || !canSubmit) return;
      e.preventDefault();
      onComplete(q.trim());
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [q, canSubmit, onComplete]);

  const pickRandom = () => {
    const pool = eligiblePrompts({ donePrompts, questionOfNight: q });
    setQ(pickOne(pool).text);
    setUsedRandom(true);
    taRef.current?.focus();
  };

  return (
    <div style={{
      background: C.bg,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        padding: '1.6rem 3rem',
        borderBottom: `1px solid ${C.borderSoft}`
      }}>
        {hideBrand ? <div /> : <HomeBrandMark />}
      </div>

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(2rem, 5vh, 4rem) clamp(1.5rem, 5vw, 3rem)'
      }}>
        <div style={{
          width: '100%',
          maxWidth: 760,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'clamp(1.75rem, 3.5vh, 2.5rem)'
        }}>
          <QuestionOfNightBadge text={q} />

          <div style={{ textAlign: 'center', maxWidth: 560 }}>
            <h1 style={{
              color: C.text,
              fontFamily: F.stage,
              fontSize: 'clamp(2.4rem, 3.4vw + 0.9rem, 3.5rem)',
              fontWeight: 700,
              letterSpacing: '0.01em',
              lineHeight: 1.1,
              margin: 0
            }}>
              Set tonight&apos;s {promptNoun(q)}
            </h1>
            <p style={{
              color: C.muted,
              fontSize: 'clamp(1rem, 1.1vw + 0.35rem, 1.12rem)',
              marginTop: '1rem',
              lineHeight: 1.6,
              marginBottom: 0
            }}>
              This appears on the home screen and is offered first when speakers choose.
            </p>
          </div>

          <div style={{
            width: '100%',
            borderBottom: `1px solid ${canSubmit ? C.goldDim : C.border}`,
            transition: 'border-color 0.3s ease'
          }}>
            <textarea
              ref={taRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Type your ${promptNoun(q)} here…`}
              rows={3}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'transparent',
                border: 'none',
                padding: 'clamp(1rem, 2vw, 1.5rem) 0.25rem',
                color: C.text,
                caretColor: C.gold,
                fontSize: 'clamp(1.6rem, 1.8vw + 0.6rem, 2.1rem)',
                fontFamily: F.stage,
                fontWeight: 700,
                resize: 'none',
                outline: 'none',
                lineHeight: 1.4,
                minHeight: '7rem',
                textAlign: 'center'
              }}
            />
          </div>

          <div style={{
            display: 'flex',
            gap: '0.85rem',
            flexWrap: 'wrap',
            justifyContent: 'center',
            width: '100%',
            paddingTop: '0.5rem'
          }}>
            <Btn variant="surface" size="md" onClick={pickRandom}>
              {usedRandom ? `Load another ${promptNoun(q)}` : `Load random ${promptNoun(q)}`}
            </Btn>
            <Btn
              variant="gold"
              size="md"
              disabled={!canSubmit}
              onClick={() => canSubmit && onComplete(q.trim())}
            >
              Continue
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MANAGE SPEAKERS MODAL ────────────────────────────────────────────────────
function ManageSpeakersModal({ participants, onClose, onAdd, onRemove, onSetDone, onSetFirstTimer, onResetAll }) {
  const [newName, setNewName] = useState('');
  const inputRef = useRef(null);
  const pending = participants.filter((p) => !p.done);
  const done = participants.filter((p) => p.done);

  useEffect(() => {
    inputRef.current?.focus();
    const h = (e) => { if (e.code === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const submitAdd = () => {
    const t = newName.trim();
    if (!t) return;
    onAdd(t);
    setNewName('');
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem'
      }}
      onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Manage speakers"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 100%)',
          maxHeight: 'min(85vh, 720px)',
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
        <div style={{
          padding: '1.35rem 1.5rem',
          borderBottom: `1px solid ${C.borderSoft}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ color: C.text, fontSize: '1.3rem', fontWeight: 500, letterSpacing: '-0.01em' }}>Manage Speakers</div>
            <div style={{ color: C.dim, fontSize: '0.92rem', marginTop: '0.3rem' }}>
              {pending.length} in draw · {done.length} spoken
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', color: C.dim,
              fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1, padding: '0.25rem'
            }}>
            ×
          </button>
        </div>

        <div style={{ padding: '1rem 1.5rem', borderBottom: `1px solid ${C.borderSoft}`, display: 'flex', gap: '0.5rem' }}>
          <input
            ref={inputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitAdd(); } }}
            placeholder="Add a speaker…"
            style={{
              flex: 1, background: 'rgba(205,228,254,0.04)', border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '0.65rem 1rem', caretColor: C.gold,
              color: C.text, fontSize: '1.02rem', fontFamily: F.ui, outline: 'none'
            }}
          />
          <Btn variant="primary" size="sm" onClick={submitAdd}>Add</Btn>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 0' }}>
          {participants.length === 0 &&
          <div style={{ color: C.dim, textAlign: 'center', padding: '2.5rem 1.5rem', fontSize: '1.05rem' }}>
            No speakers yet — add one above.
          </div>
          }
          {participants.map((p) =>
          <div
            key={p.name}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.65rem',
              padding: '0.65rem 1.5rem',
              borderBottom: `1px solid ${C.borderSoft}`
            }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                color: p.done ? C.dim : C.text,
                fontSize: '1.08rem',
                fontWeight: 400,
                textDecoration: p.done ? 'line-through' : 'none'
              }}>
                {p.name}
              </div>
              <div style={{
                fontSize: '0.7rem',
                fontWeight: 500,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                marginTop: '0.2rem',
                color: p.done ? C.dim : p.firstTimer ? C.gold : C.muted
              }}>
                {p.done ? 'Spoken' : p.firstTimer ? 'First timer · In draw' : 'In draw'}
              </div>
            </div>
            {!p.done &&
            <Btn
              variant={p.firstTimer ? 'outline' : 'surface'}
              size="sm"
              onClick={() => onSetFirstTimer(p.name, !p.firstTimer)}>
              {p.firstTimer ? 'Unmark' : 'First timer'}
            </Btn>
            }
            <Btn
              variant="surface"
              size="sm"
              onClick={() => onSetDone(p.name, !p.done)}>
              {p.done ? 'Undo' : 'Mark done'}
            </Btn>
            <button
              type="button"
              aria-label={`Remove ${p.name}`}
              onClick={() => onRemove(p.name)}
              style={{
                background: 'none', border: 'none', color: C.dim,
                fontSize: '1.25rem', cursor: 'pointer', padding: '0.25rem 0.4rem',
                lineHeight: 1
              }}>
              ×
            </button>
          </div>
          )}
        </div>

        <div style={{
          padding: '1rem 1.5rem',
          borderTop: `1px solid ${C.borderSoft}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem'
        }}>
          <Btn
            variant="outline"
            size="sm"
            disabled={done.length === 0}
            onClick={() => {
              if (done.length === 0) return;
              if (window.confirm(`Mark all ${done.length} speaker${done.length === 1 ? '' : 's'} as not done?`)) {
                onResetAll();
              }
            }}>
            Mark all as not done
          </Btn>
          <Btn variant="gold" size="sm" onClick={onClose}>Done</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── PROMPT SELECTION ─────────────────────────────────────────────────────────
function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Prompts still on the table: not permanently done, not used tonight, not the
 *  prompt of the night, not already on screen. If a rule empties the pool the
 *  constraints relax in order (done → used → on-screen) so a long-running
 *  bank never leaves a speaker with nothing. */
function eligiblePrompts({ donePrompts, usedQuestions, questionOfNight, excludeTexts = [] }) {
  const done = donePrompts || new Set();
  const used = usedQuestions || new Set();
  const onScreen = new Set([questionOfNight, ...excludeTexts]);
  const tiers = [
    (p) => !done.has(p.id) && !used.has(p.text) && !onScreen.has(p.text),
    (p) => !used.has(p.text) && !onScreen.has(p.text),
    (p) => !onScreen.has(p.text),
    () => true
  ];
  for (const keep of tiers) {
    const pool = PROMPTS.filter(keep);
    if (pool.length) return pool;
  }
  return PROMPTS;
}

/** The two random options offered to a speaker.
 *  A: a random "about you" prompt.
 *  B: scenario or big (coin flip), from a different theme than A; falls back to
 *     the other style, then to any style, before giving up on the theme rule. */
function pickSpeakerOptions({ donePrompts, usedQuestions, questionOfNight }) {
  const pool = eligiblePrompts({ donePrompts, usedQuestions, questionOfNight });
  const you = pool.filter((p) => p.type === 'you');
  const a = pickOne(you.length ? you : pool);
  const want = Math.random() < 0.5 ? 'scenario' : 'big';
  const other = want === 'scenario' ? 'big' : 'scenario';
  const rest = pool.filter((p) => p.id !== a.id);
  const candidates = [
    rest.filter((p) => p.type === want && p.theme !== a.theme),
    rest.filter((p) => p.type === other && p.theme !== a.theme),
    rest.filter((p) => p.theme !== a.theme),
    rest
  ].find((list) => list.length);
  const b = candidates ? pickOne(candidates) : null;
  return b ? [a.text, b.text] : [a.text];
}

/** Yolo: any style, but from a theme none of the on-screen randoms use. */
function pickYoloPrompt({ donePrompts, usedQuestions, questionOfNight, carouselTexts }) {
  const pool = eligiblePrompts({ donePrompts, usedQuestions, questionOfNight, excludeTexts: carouselTexts });
  const takenThemes = new Set(carouselTexts.map((t) => PROMPT_BY_TEXT[t]?.theme).filter(Boolean));
  const offTheme = pool.filter((p) => !takenThemes.has(p.theme));
  return pickOne(offTheme.length ? offTheme : pool).text;
}

// ─── PROMPTS MODAL (done list — persistent, exportable) ───────────────────────
function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function PromptsModal({ donePrompts, onClose, onSetDone, onResetAll, onImport }) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState(donePrompts.size ? 'done' : 'all');
  const [notice, setNotice] = useState('');
  const fileRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    searchRef.current?.focus();
    const h = (e) => { if (e.code === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const rows = PROMPTS.filter((p) =>
    (view === 'all' || donePrompts.has(p.id)) &&
    (!q || p.text.toLowerCase().includes(q) || PROMPT_THEMES[p.theme].toLowerCase().includes(q))
  );
  const doneCount = donePrompts.size;
  const left = PROMPTS.length - doneCount;

  const exportDone = () => {
    downloadJson(`aps-prompts-done-${new Date().toISOString().slice(0, 10)}.json`, {
      app: 'auckland-public-speaking',
      version: 1,
      exportedAt: new Date().toISOString(),
      donePrompts: [...donePrompts]
    });
    setNotice(`Exported ${doneCount} done prompt${doneCount === 1 ? '' : 's'}.`);
  };

  const importFile = async (file) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const ids = Array.isArray(data) ? data : data && data.donePrompts;
      if (!Array.isArray(ids)) throw new Error('not a prompts export');
      const valid = ids.filter((id) => typeof id === 'string' && PROMPT_BY_ID[id]);
      const added = valid.filter((id) => !donePrompts.has(id)).length;
      onImport(valid);
      setNotice(`Imported ${valid.length} — ${added} new. Merged with what was already here.`);
      setView('done');
    } catch (e) {
      setNotice("That file isn't a prompts export.");
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const tab = (key, label) => (
    <button
      type="button"
      onClick={() => setView(key)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '0.35rem 0',
        fontFamily: F.ui, fontSize: '0.92rem', fontWeight: 500, letterSpacing: '0.02em',
        color: view === key ? C.text : C.dim,
        borderBottom: `2px solid ${view === key ? C.gold : 'transparent'}`
      }}>
      {label}
    </button>
  );

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem'
      }}
      onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Prompts"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 'min(680px, 100%)',
          maxHeight: 'min(85vh, 780px)',
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
        <div style={{
          padding: '1.35rem 1.5rem 1rem',
          borderBottom: `1px solid ${C.borderSoft}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
        }}>
          <div>
            <div style={{ color: C.text, fontSize: '1.3rem', fontWeight: 500, letterSpacing: '-0.01em' }}>Prompts</div>
            <div style={{ color: C.dim, fontSize: '0.92rem', marginTop: '0.3rem' }}>
              {doneCount} done · {left} left of {PROMPTS.length}. A prompt is marked done the moment a speech starts on it, and stays done across reloads.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', color: C.dim,
              fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1, padding: '0.25rem'
            }}>
            ×
          </button>
        </div>

        <div style={{ padding: '0.75rem 1.5rem', borderBottom: `1px solid ${C.borderSoft}`, display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
          {tab('done', `Done (${doneCount})`)}
          {tab('all', `All (${PROMPTS.length})`)}
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search prompts or themes…"
            style={{
              flex: 1, marginLeft: 'auto', background: 'rgba(205,228,254,0.04)', border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '0.55rem 0.9rem', caretColor: C.gold,
              color: C.text, fontSize: '0.98rem', fontFamily: F.ui, outline: 'none', minWidth: 0
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
          {rows.length === 0 &&
          <div style={{ color: C.dim, textAlign: 'center', padding: '2.5rem 1.5rem', fontSize: '1.05rem' }}>
            {view === 'done' && !q ? 'Nothing marked done yet.' : 'No prompts match.'}
          </div>
          }
          {rows.map((p) => {
            const isDone = donePrompts.has(p.id);
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.65rem',
                  padding: '0.6rem 1.5rem',
                  borderBottom: `1px solid ${C.borderSoft}`
                }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: isDone ? C.dim : C.text,
                    fontSize: '1.02rem',
                    fontWeight: 400,
                    textDecoration: isDone ? 'line-through' : 'none',
                    lineHeight: 1.35
                  }}>
                    {p.text}
                  </div>
                </div>
                <Btn variant="surface" size="sm" onClick={() => onSetDone(p.id, !isDone)}>
                  {isDone ? 'Not done' : 'Mark done'}
                </Btn>
              </div>
            );
          })}
        </div>

        <div style={{
          padding: '1rem 1.5rem',
          borderTop: `1px solid ${C.borderSoft}`,
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem'
        }}>
          <Btn variant="surface" size="sm" disabled={doneCount === 0} onClick={exportDone}>Export done list</Btn>
          <Btn variant="surface" size="sm" onClick={() => fileRef.current?.click()}>Import…</Btn>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => importFile(e.target.files && e.target.files[0])}
            style={{ display: 'none' }}
          />
          <Btn
            variant="outline"
            size="sm"
            disabled={doneCount === 0}
            onClick={() => {
              if (doneCount === 0) return;
              if (window.confirm(`Mark all ${doneCount} prompt${doneCount === 1 ? '' : 's'} as not done? Export first if you might want them back.`)) {
                onResetAll();
                setNotice('All prompts are back in the hat.');
              }
            }}>
            Reset all
          </Btn>
          <span style={{ flex: 1, minWidth: 120, color: C.muted, fontSize: '0.9rem', textAlign: 'right' }}>{notice}</span>
          <Btn variant="gold" size="sm" onClick={onClose}>Done</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
function HomeScreen({ questionOfNight, participants, firstTimerPulseName, onRegister, onDraw, onEditQuestion, onShowQR, onToggleDemo, demoMode, onAddParticipant, onRemoveParticipant, onSetParticipantDone, onSetParticipantFirstTimer, onResetSpeakers, reopenManage, onReopenManageConsumed, walkAllow = null, onWalkAdvance, onWalkNudge, highlightSpeakers = false, hideBrand = false, donePrompts = new Set(), onSetPromptDone, onResetDonePrompts, onImportDonePrompts }) {
  const [showManage, setShowManage] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const modalOpen = showManage || showPrompts;
  const remaining = participants.filter((p) => !p.done);
  const total = participants.length;
  const done = participants.filter((p) => p.done).length;

  // Let the step-5 coach card land first, then animate the Speakers highlight + arrow in.
  const [highlightIn, setHighlightIn] = useState(false);
  useEffect(() => {
    if (!highlightSpeakers) { setHighlightIn(false); return undefined; }
    const t = setTimeout(() => setHighlightIn(true), 550);
    return () => clearTimeout(t);
  }, [highlightSpeakers]);

  // Walk-through lock: only the action named by the active step is available.
  const walkActive = !!walkAllow;
  const canAddSpeaker = !walkActive || walkAllow === 'addSpeaker' || walkAllow === 'addMore';
  const canManage = !walkActive || walkAllow === 'manage';
  const canUseQR = !walkActive; // QR launcher is locked during the walk-through
  const nudge = useCallback(() => { onWalkNudge && onWalkNudge(); }, [onWalkNudge]);

  // Opening Speakers advances the "Open Speakers" step; closing advances the "Close Speakers" step.
  const openManage = useCallback(() => {
    setShowManage(true);
    if (walkAllow === 'manage' && onWalkAdvance) onWalkAdvance('manage');
  }, [walkAllow, onWalkAdvance]);

  const advanceManageStep = useCallback(() => {
    if (walkAllow === 'closeManage' && onWalkAdvance) onWalkAdvance('closeManage');
  }, [walkAllow, onWalkAdvance]);

  useEffect(() => {
    if (!reopenManage) return;
    setShowManage(true);
    onReopenManageConsumed && onReopenManageConsumed();
  }, [reopenManage, onReopenManageConsumed]);

  // ⌘D / Ctrl+D — toggle demo mode (sample speakers + accelerated speech timers)
  useEffect(() => {
    if (!onToggleDemo || modalOpen) return;
    if (walkAllow && walkAllow !== 'demo' && walkAllow !== 'draw') return;
    const h = (e) => {
      if (!cmdPressed(e) || e.code !== 'KeyD') return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      onToggleDemo();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onToggleDemo, modalOpen, walkAllow]);

  // Block Space → draw while manage modal is open
  useEffect(() => {
    if (!modalOpen) return;
    const h = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [modalOpen]);

  // Listen for any letter key press → launch register screen with that char
  useEffect(() => {
    if (modalOpen || !canAddSpeaker) return;
    const h = (e) => {
      // Skip if modifier keys held, or if user is typing in an input already
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // Only single printable characters (letters/numbers/space chars are 1 char keys, but we exclude Space)
      if (e.key.length === 1 && /[a-zA-Z0-9'\-]/.test(e.key)) {
        e.preventDefault();
        onRegister(e.key);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onRegister, modalOpen, canAddSpeaker]);

  // Off-path nudge: if the host presses a meaningful key the active step doesn't ask for,
  // block it and shake the coach card to bring focus back to the current step.
  useEffect(() => {
    if (!walkActive || modalOpen) return undefined;
    const h = (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const isCmd = cmdPressed(e);
      let disallowed = false;
      if (isCmd && e.code === 'KeyD') {
        disallowed = !(walkAllow === 'demo' || walkAllow === 'draw');
      } else if (isCmd && e.code === 'KeyF') {
        disallowed = walkAllow !== 'markFT';
      } else if (!isCmd && !e.altKey && e.code === 'Space') {
        disallowed = walkAllow !== 'draw';
      } else if (!isCmd && !e.altKey && e.key.length === 1 && /[a-zA-Z0-9'\-]/.test(e.key)) {
        disallowed = !canAddSpeaker;
      }
      if (disallowed) {
        e.preventDefault();
        e.stopImmediatePropagation();
        nudge();
      }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [walkActive, walkAllow, modalOpen, canAddSpeaker, nudge]);

  return (
    <div style={{ background: C.bg, height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

      {showManage &&
      <ManageSpeakersModal
        participants={participants}
        onClose={() => { setShowManage(false); advanceManageStep(); }}
        onAdd={(name) => onAddParticipant(name, 'manage')}
        onRemove={onRemoveParticipant}
        onSetDone={onSetParticipantDone}
        onSetFirstTimer={onSetParticipantFirstTimer}
        onResetAll={onResetSpeakers}
      />
      }
      {showPrompts && onSetPromptDone &&
      <PromptsModal
        donePrompts={donePrompts}
        onClose={() => setShowPrompts(false)}
        onSetDone={onSetPromptDone}
        onResetAll={onResetDonePrompts}
        onImport={onImportDonePrompts}
      />
      }

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.6rem 3rem', borderBottom: `1px solid ${C.borderSoft}` }}>
        {hideBrand ? <div /> : <HomeBrandMark />}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {demoMode &&
          <span style={{
            color: FIELD.blue,
            fontSize: '0.8rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontWeight: 700,
            fontFamily: F.ui
          }}>
            Demo · {kbd('D')} to exit
          </span>
          }
          <div style={{ position: 'relative', display: 'inline-flex', gap: '0.65rem' }}>
            {highlightSpeakers &&
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: '-7px',
                pointerEvents: 'none',
                zIndex: 1,
                opacity: highlightIn ? 1 : 0,
                transform: highlightIn ? 'scale(1)' : 'scale(0.82)',
                transition: 'opacity 0.4s ease, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 14,
                  border: `2px solid ${C.gold}`,
                  boxShadow: `0 0 0 4px ${C.gold}28, 0 0 28px ${C.gold}44`,
                  animation: highlightIn ? 'walkthroughHighlightPulse 2.2s ease-in-out infinite' : 'none'
                }}
              />
            </div>
            }
            {highlightSpeakers &&
            <div
              aria-hidden
              style={{
                position: 'absolute',
                right: 'calc(100% + 14px)',
                top: '50%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                color: C.gold,
                fontWeight: 700,
                fontSize: '1rem',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 2,
                opacity: highlightIn ? 1 : 0,
                transform: highlightIn ? 'translateY(-50%) translateX(0)' : 'translateY(-50%) translateX(14px)',
                transition: 'opacity 0.4s ease, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                animation: highlightIn ? 'walkthroughArrowNudge 1.1s ease-in-out infinite' : 'none'
              }}>
                <span style={{ letterSpacing: '0.04em' }}>Open this</span>
                <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{'\u2192'}</span>
              </div>
            </div>
            }
            <HomeSubduedButton
              ariaLabel="Manage speakers"
              onClick={() => { if (canManage) openManage(); else nudge(); }}
              locked={!canManage}>
              Speakers
            </HomeSubduedButton>
            {onSetPromptDone &&
            <HomeSubduedButton
              ariaLabel="Prompts — done list"
              onClick={() => { if (canUseQR) setShowPrompts(true); else nudge(); }}
              locked={!canUseQR}>
              Prompts
            </HomeSubduedButton>
            }
          </div>
          <HomeIconButton
            ariaLabel="WhatsApp QR code"
            onClick={() => { if (canUseQR) onShowQR(); else nudge(); }}
            locked={!canUseQR}>
            <QrCodeIcon />
          </HomeIconButton>

        </div>
      </div>

      {/* Centre — wider gutters + scaled type so long questions wrap comfortably */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem clamp(1rem, 3.25vw, 2rem)',
        textAlign: 'center',
        minHeight: 0
      }}>
        <div style={{ marginBottom: '2.5rem' }}>
          <QuestionOfNightBadge large text={questionOfNight} />
        </div>
        <QuestionDisplayText style={{ margin: '0 auto 4rem', padding: '0 3rem' }}>
          {questionOfNight}
        </QuestionDisplayText>

        {total === 0 &&
        <div style={{ color: C.muted, fontSize: '1.6rem' }}></div>
        }
        {total > 0 && remaining.length === 0 &&
        <div style={{
          color: FIELD.blue,
          fontFamily: F.stage,
          fontWeight: 700,
          fontSize: 'clamp(2.2rem, 3.2vw, 3rem)'
        }}>
          All speakers done — great night.
        </div>
        }
      </div>

      {/* Speaker roll — quiet outlined pills in the same voice as the top-right buttons */}
      {total > 0 &&
      <div style={{
        padding: '1.25rem 3rem 1.5rem',
        borderTop: `1px solid ${C.borderSoft}`,
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        justifyContent: 'center'
      }}>
          {participants.map((p) => {
            const pulsing = firstTimerPulseName === p.name;
            const showFt = p.firstTimer && !p.done;
            return (
        <span key={p.name} style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.42rem 0.85rem',
          borderRadius: 10,
          border: `1px solid ${p.done ? C.borderSoft : C.border}`,
          fontFamily: F.ui,
          color: p.done ? C.dim : C.muted,
          fontSize: '0.92rem',
          fontWeight: 500,
          letterSpacing: '0.02em',
          lineHeight: 1.2,
          opacity: p.done ? 0.6 : 0.9,
          textDecoration: p.done ? 'line-through' : 'none',
          textDecorationColor: 'rgba(205,228,254,0.4)',
          animation: pulsing ? 'ftNamePulse 1.2s ease-out' : undefined
        }}>
              {p.name}
              {showFt &&
              <span aria-label="first timer" style={{
                fontSize: '0.72em',
                color: FIELD.blue,
                lineHeight: 1
              }}>
                ✦
              </span>
              }
            </span>
            );
          })}
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
    const el = inputRef.current;
    if (el) {
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, []);

  const submit = () => {
    const t = name.trim();
    if (!t) {
      onDone();
      return;
    }
    onAdd(t);
    onDone();
  };

  return (
    <div style={{ background: C.bg, height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 6rem', gap: '3rem' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <Badge tone="quiet" large>Add your name</Badge>
        </div>
        <p style={{ color: 'rgba(205,228,254,0.88)', fontSize: '1.45rem', marginTop: '0.5rem', fontWeight: 500 }}>
          Type your name, then press <span style={{ color: FIELD.cream, fontWeight: 700 }}>Enter</span>
        </p>
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
          borderBottom: '2px solid rgba(205,228,254,0.6)',
          padding: '1.5rem 1rem',
          color: FIELD.cream,
          fontSize: 'clamp(4.5rem, 10vw, 10rem)',
          fontFamily: F.stage,
          fontWeight: 700,
          textAlign: 'center',
          letterSpacing: '0',
          outline: 'none',
          caretColor: FIELD.cream
        }} />

      <div style={{ color: 'rgba(205,228,254,0.55)', fontSize: '1.05rem', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>
        Press Esc to cancel
      </div>
    </div>);
}

// ─── QR CODE SCREEN ───────────────────────────────────────────────────────────
/** Static QR rendered as crisp SVG from a string. Error level M (15% damage
 *  tolerance) suits a projector; typeNumber 0 picks the smallest version that
 *  fits. Falls back to the raw link as text if qrcode.js failed to load. */
function QRCodeSvg({ value, label, style = {} }) {
  const cells = React.useMemo(() => {
    if (typeof qrcode !== 'function') return null;
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    const rects = [];
    for (let r = 0; r < n; r++) {
      let run = 0;
      for (let c = 0; c <= n; c++) {
        const dark = c < n && qr.isDark(r, c);
        if (dark) { run += 1; continue; }
        if (run) { rects.push(`M${c - run} ${r}h${run}v1h-${run}z`); run = 0; }
      }
    }
    return { n, d: rects.join('') };
  }, [value]);

  if (!cells) {
    return <div style={{ ...style, color: '#111', fontFamily: F.ui, fontSize: '0.9rem', wordBreak: 'break-all' }}>{value}</div>;
  }
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${cells.n} ${cells.n}`}
      shapeRendering="crispEdges"
      style={style}>
      <rect width={cells.n} height={cells.n} fill="#fff" />
      <path d={cells.d} fill="#111" />
    </svg>
  );
}

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
    <div style={{ background: C.bg, height: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar — consistent with home */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.6rem 3rem', borderBottom: `1px solid ${C.borderSoft}` }}>
        <HomeBrandMark />
        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
          <HomeIconButton ariaLabel="Close — back to home" onClick={onBack}>
            <BackIcon />
          </HomeIconButton>
        </div>
      </div>

      {/* Centre — two panels: WhatsApp join (left) + bank details (right) */}
      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(1.5rem, 3vh, 2.5rem) clamp(1.5rem, 4vw, 3rem)'
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'stretch',
          justifyContent: 'center',
          gap: 'clamp(1.5rem, 3.5vw, 3rem)',
          width: '100%',
          maxWidth: 1180
        }}>

          {/* ── WhatsApp join ── */}
          <div style={QR_PANEL_STYLE}>
            <div style={QR_EYEBROW_STYLE}>Join our WhatsApp</div>
            <div style={{ background: '#fff', padding: 'clamp(1rem, 1.6vw, 1.5rem)', borderRadius: 12 }}>
              <QRCodeSvg
                value={WHATSAPP_INVITE_URL}
                label="WhatsApp group QR code"
                style={{ display: 'block', width: 'min(34vh, 320px)', height: 'min(34vh, 320px)' }}
              />
            </div>
            <p style={{ color: C.muted, fontSize: '1.02rem', fontWeight: 400, margin: '1.25rem 0 0', lineHeight: 1.5 }}>
              Point your camera at the code
            </p>
          </div>

          {/* ── Bank details ── */}
          <BankDetailsCard />

        </div>
      </div>
    </div>);
}

// ─── BANK DETAILS CARD (shown on the QR / end-of-night screen) ─────────────────
const QR_PANEL_STYLE = {
  flex: '1 1 340px',
  maxWidth: 480,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  background: 'rgba(244,239,230,0.02)',
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: 'clamp(1.5rem, 2.5vw, 2.25rem)'
};

const QR_EYEBROW_STYLE = {
  color: C.gold,
  fontFamily: F.ui,
  fontSize: '0.82rem',
  letterSpacing: '0.3em',
  paddingLeft: '0.3em',
  textTransform: 'uppercase',
  fontWeight: 500,
  marginBottom: '1.4rem'
};

function BankDetailRow({ label, value, mono = false, last = false }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.35rem',
      padding: '0.95rem 0',
      borderBottom: last ? 'none' : `1px solid ${C.borderSoft}`
    }}>
      <span style={{
        color: C.dim,
        fontSize: '0.72rem',
        fontWeight: 500,
        letterSpacing: '0.2em',
        textTransform: 'uppercase'
      }}>
        {label}
      </span>
      <span style={{
        color: C.text,
        fontSize: mono ? 'clamp(1.5rem, 2.2vw, 2rem)' : 'clamp(1.35rem, 1.9vw, 1.75rem)',
        fontWeight: 500,
        letterSpacing: mono ? '0.03em' : '0',
        fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
        lineHeight: 1.15
      }}>
        {value}
      </span>
    </div>
  );
}

function BankDetailsCard() {
  return (
    <div style={{
      ...QR_PANEL_STYLE,
      alignItems: 'stretch',
      textAlign: 'left'
    }}>
      <div style={QR_EYEBROW_STYLE}>Support the night</div>
      <p style={{ color: C.muted, fontSize: '1.02rem', fontWeight: 400, margin: '-0.5rem 0 0.5rem', lineHeight: 1.6 }}>
        We have a koha for meetup fees to keep the group running. Anything is appreciated — around $2–$5 is recommended.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <BankDetailRow label="Account name" value={BANK_DETAILS.accountName} />
        <BankDetailRow label="Account number" value={groupDigits(BANK_DETAILS.accountNumber)} mono />
        <BankDetailRow label="Reference" value={BANK_DETAILS.reference} mono last />
      </div>
    </div>
  );
}

// ─── HOST WALK-THROUGH COACH ──────────────────────────────────────────────────
// Minimal key chip used to emphasise the single key press a step asks for.
function WalkKeyChip({ children }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '1.6rem',
      height: '1.7rem',
      padding: '0 0.55rem',
      borderRadius: 6,
      background: 'rgba(205,228,254,0.05)',
      border: '1px solid rgba(205,228,254,0.4)',
      boxShadow: 'inset 0 -1.5px 0 rgba(0,0,0,0.2)',
      color: C.text,
      fontFamily: F.ui,
      fontSize: '0.88rem',
      fontWeight: 500,
      lineHeight: 1
    }}>
      {children}
    </span>
  );
}

function WalkthroughCoach({ title, body, cue = null, stepNumber, totalSteps, isLast, onExit, onSkip, showSkip = false, progress = null, nudgeKey = 0, canFinish = true, placement = 'top-left' }) {
  const lines = body ? (Array.isArray(body) ? body : [body]) : [];
  const showProgress = progress && Number.isFinite(progress.target);
  const cueKeys = cue && Array.isArray(cue.keys) ? cue.keys : [];
  const [shaking, setShaking] = useState(false);
  const [popping, setPopping] = useState(false);

  useEffect(() => {
    if (!nudgeKey) return undefined;
    setShaking(true);
    const t = setTimeout(() => setShaking(false), 450);
    return () => clearTimeout(t);
  }, [nudgeKey]);

  // Pop the card whenever the step changes so the eye is drawn to the new instruction.
  useEffect(() => {
    setPopping(true);
    const t = setTimeout(() => setPopping(false), 420);
    return () => clearTimeout(t);
  }, [stepNumber]);

  const animation = shaking
    ? 'walkthroughShake 0.45s cubic-bezier(.36,.07,.19,.97) both'
    : popping
      ? 'walkthroughCoachPop 0.42s ease-out'
      : 'none';

  const atBottom = placement === 'bottom-left';
  const edge = atBottom
    ? { bottom: 'clamp(1rem, 3vh, 2rem)' }
    : { top: 'clamp(1rem, 3vh, 2rem)' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute',
        left: 'clamp(1rem, 2.5vw, 2rem)',
        ...edge,
        width: 'min(380px, calc(100vw - 2rem))',
        background: '#FDFAF4',
        border: `1px solid ${C.goldDim}`,
        borderRadius: 14,
        padding: '1.2rem 1.35rem',
        boxShadow: '0 18px 48px rgba(0,0,0,0.28)',
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        transformOrigin: atBottom ? 'bottom left' : 'top left',
        animation
      }} data-walkthrough-ui>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            color: C.gold,
            fontSize: '0.7rem',
            fontWeight: 500,
            letterSpacing: '0.26em',
            textTransform: 'uppercase'
          }}>
            Host walk-through
          </span>
          <span style={{ color: C.dim, fontSize: '0.82rem', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
            {stepNumber} / {totalSteps}
          </span>
        </div>

        <div style={{ color: C.text, fontSize: '1.2rem', fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.25 }}>
          {title}
        </div>

        {lines.length > 0 &&
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {lines.map((l, i) =>
          <p key={i} style={{ margin: 0, color: C.muted, fontSize: '0.95rem', fontWeight: 400, lineHeight: 1.5 }}>{l}</p>
          )}
        </div>
        }

        {cue && (cueKeys.length > 0 || cue.text) &&
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.45rem',
          padding: '0.55rem 0.7rem',
          background: 'rgba(233,79,46,0.08)',
          border: '1px solid rgba(233,79,46,0.3)',
          borderRadius: 10
        }}>
          {cueKeys.map((k, i) => <WalkKeyChip key={i}>{k}</WalkKeyChip>)}
          {cue.text &&
          <span style={{ color: C.text, fontSize: '0.95rem', fontWeight: 400 }}>{cue.text}</span>
          }
        </div>
        }

        {showProgress &&
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          padding: '0.55rem 0.7rem',
          background: 'rgba(233,79,46,0.08)',
          border: '1px solid rgba(233,79,46,0.3)',
          borderRadius: 10
        }}>
          <span style={{ color: C.gold, fontSize: '0.92rem', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
            Added {Math.min(progress.current, progress.target)} of {progress.target}
          </span>
          <div style={{ flex: 1, height: 3, borderRadius: 999, background: 'rgba(233,79,46,0.2)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, (progress.current / progress.target) * 100)}%`,
              background: C.gold,
              borderRadius: 999,
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
        }

        {(showSkip || (isLast && canFinish)) &&
        <div style={{
          display: 'flex',
          justifyContent: showSkip && !isLast ? 'space-between' : 'flex-end',
          alignItems: 'center',
          marginTop: '0.15rem'
        }}>
          {showSkip && !isLast &&
          <button
            type="button"
            onClick={onSkip}
            style={{
              background: 'none', border: 'none', color: C.dim,
              fontFamily: F.ui, fontSize: '0.88rem', fontWeight: 400,
              cursor: 'pointer', padding: 0, textDecoration: 'underline', opacity: 0.85
            }}>
            Skip walk-through
          </button>
          }
          {isLast && canFinish &&
          <button
            type="button"
            onClick={onExit}
            style={{
              background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10,
              padding: '0.55rem 1.2rem', fontFamily: F.ui, fontWeight: 500,
              fontSize: '0.95rem', cursor: 'pointer'
            }}>
            Finish
          </button>
          }
        </div>
        }
      </div>
    </div>
  );
}

function WalkthroughIntroModal({ onStart, programmeHref = 'programme.html' }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'clamp(1rem, 4vw, 2.5rem)',
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)'
    }} data-walkthrough-ui>
      <div style={{
        width: 'min(560px, 100%)',
        maxHeight: 'calc(100vh - 2rem)',
        overflowY: 'auto',
        background: '#FDFAF4',
        border: `1px solid ${C.goldDim}`,
        borderRadius: 16,
        padding: 'clamp(1.75rem, 4vw, 2.5rem)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.1rem',
        boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
        animation: 'walkthroughCoachPop 0.42s ease-out'
      }}>
        <span style={{
          alignSelf: 'flex-start',
          color: C.gold,
          fontSize: '0.72rem',
          fontWeight: 500,
          letterSpacing: '0.26em',
          textTransform: 'uppercase'
        }}>
          Host walk-through
        </span>

        <div style={{
          color: C.text,
          fontFamily: F.stage,
          fontSize: 'clamp(1.7rem, 4vw, 2.2rem)',
          fontWeight: 700,
          letterSpacing: '-0.01em',
          lineHeight: 1.18
        }}>
          Thanks for hosting Auckland Public Speaking
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <p style={{ margin: 0, color: C.muted, fontSize: '1.05rem', fontWeight: 400, lineHeight: 1.55 }}>
            Grab the programme so you{'\u2019'}ve got the runsheet handy:
          </p>
          <a
            href={programmeHref}
            target="_blank"
            rel="noopener"
            style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'transparent',
              color: C.gold,
              textDecoration: 'none',
              border: `1px solid ${C.goldDim}`,
              borderRadius: 10,
              padding: '0.55rem 1.1rem',
              fontWeight: 500,
              fontSize: '0.95rem'
            }}>
            Open the programme
            <span aria-hidden style={{ fontSize: '0.9rem', lineHeight: 1 }}>{'\u2197'}</span>
          </a>
        </div>

        <p style={{ margin: 0, color: C.muted, fontSize: '1.05rem', fontWeight: 400, lineHeight: 1.55 }}>
          It{'\u2019'}s just a rough guide. You{'\u2019'}re completely free to add your own spin and run the night however feels right to you.
        </p>

        <p style={{ margin: 0, color: C.muted, fontSize: '1.05rem', fontWeight: 400, lineHeight: 1.55 }}>
          When you{'\u2019'}re ready, we{'\u2019'}ll walk you through how the app works so you can confidently explain it to the room and facilitate the evening. It takes about 5 minutes.
        </p>

        <button
          type="button"
          onClick={onStart}
          style={{
            marginTop: '0.5rem',
            alignSelf: 'stretch',
            background: C.surface,
            color: C.text,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: '0.95rem 1.5rem',
            fontFamily: F.ui,
            fontWeight: 500,
            fontSize: '1.1rem',
            letterSpacing: '0.01em',
            cursor: 'pointer'
          }}>
          Start the walk-through
        </button>
      </div>
    </div>
  );
}

function WalkthroughRestartButton({ onRestart }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, pointerEvents: 'none' }}>
      <button
        type="button"
        data-walkthrough-ui
        onClick={onRestart}
        style={{
          position: 'absolute',
          right: 'clamp(1rem, 2.5vw, 2rem)',
          bottom: 'clamp(1rem, 3vh, 2rem)',
          pointerEvents: 'auto',
          background: 'rgba(253,250,244,0.95)',
          color: C.gold,
          border: `1px solid ${C.goldDim}`,
          borderRadius: 10,
          padding: '0.6rem 1.2rem',
          fontFamily: F.ui,
          fontWeight: 500,
          fontSize: '0.92rem',
          cursor: 'pointer',
          boxShadow: '0 8px 28px rgba(0,0,0,0.25)',
          letterSpacing: '0.02em'
        }}>
        Restart walk-through
      </button>
    </div>
  );
}

// ─── KEY HINTS (shared minimal keyboard UI) ──────────────────────────────────
const KEY_FACE = {
  background: 'rgba(205,228,254,0.05)',
  border: '1.5px solid rgba(205,228,254,0.45)',
  boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.25)',
  color: 'rgba(205,228,254,0.85)',
  fontFamily: F.ui
};

const KEY_FACE_DARK = {
  background: 'rgba(205,228,254,0.07)',
  border: '1.5px solid rgba(205,228,254,0.55)',
  boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.3)',
  color: 'rgba(205,228,254,0.92)',
  fontFamily: F.ui
};

function RetroSpaceKey({ active = false, dark = false, label = 'SPACE' }) {
  const activeStyle = active ? {
    background: 'rgba(233,79,46,0.16)',
    border: '1.5px solid rgba(233,79,46,0.9)',
    boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.2)',
    color: dark ? FIELD.vermilion : C.goldBright,
    transform: 'translateY(2px)'
  } : {};
  return (
    <div
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 'clamp(210px, 36vw, 312px)',
        height: 'clamp(55px, 7.2vh, 70px)',
        padding: '0 1.8rem',
        borderRadius: 12,
        fontSize: 'clamp(1.14rem, 2.16vw, 1.32rem)',
        fontWeight: 700,
        letterSpacing: '0.32em',
        paddingLeft: 'calc(1.8rem + 0.32em)',
        ...(dark ? KEY_FACE_DARK : KEY_FACE),
        ...activeStyle
      }}>
      {label}
    </div>
  );
}

function RetroArrowKeys({ dark = false }) {
  const square = {
    width: 'clamp(53px, 9vw, 65px)',
    height: 'clamp(53px, 9vw, 65px)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    fontSize: 'clamp(1.26rem, 2.4vw, 1.56rem)',
    fontWeight: 500,
    lineHeight: 1,
    ...(dark ? KEY_FACE_DARK : KEY_FACE)
  };
  return (
    <div aria-hidden style={{ display: 'inline-flex', alignItems: 'center', gap: 'clamp(7px, 1.2vw, 11px)' }}>
      <div style={square}>←</div>
      <div style={square}>→</div>
    </div>
  );
}

function KeyboardHint({ ariaLabel, caption, children, align = 'center', style, urgent = false, dark = false }) {
  return (
    <div
      role="status"
      aria-label={ariaLabel || caption}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'right' ? 'flex-end' : align === 'left' ? 'flex-start' : 'center',
        gap: '0.85rem',
        animation: 'pulseBig 2.8s ease-in-out infinite',
        opacity: 0.94,
        ...style
      }}>
      {children}
      {caption &&
      <span style={{
        fontFamily: F.ui,
        fontSize: 'clamp(1.1rem, 1.8vw, 1.26rem)',
        fontWeight: 500,
        color: urgent ? C.pulseRedSoft : dark ? 'rgba(205,228,254,0.85)' : C.muted,
        letterSpacing: '0.03em',
        textAlign: align === 'right' ? 'right' : align === 'left' ? 'left' : 'center'
      }}>
        {caption}
      </span>
      }
    </div>
  );
}

// ─── DRAW ADMIN MENU (top-left) ───────────────────────────────────────────────
function DrawingAdminMenu({ onBackHome, showRespin, onRespin, disableBackHome = false, disableMenu = false }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'fixed',
        top: 'clamp(0.85rem, 2vh, 1.35rem)',
        left: 'clamp(0.85rem, 2vw, 1.35rem)',
        zIndex: 60
      }}>
      <div style={{ position: 'relative' }} data-walkthrough-ui>
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          disabled={disableMenu}
          onClick={() => { if (disableMenu) return; setOpen((o) => !o); }}
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            color: C.text,
            padding: '0.38rem 0.7rem',
            borderRadius: 9,
            cursor: disableMenu ? 'not-allowed' : 'pointer',
            fontSize: '0.86rem',
            fontWeight: 500,
            fontFamily: F.ui,
            letterSpacing: '0.04em',
            opacity: disableMenu ? 0.4 : 0.92,
            boxShadow: '0 2px 10px rgba(0,0,0,0.15)'
          }}>
          ☰ Menu
        </button>

        {open &&
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 6,
          minWidth: 180,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: '0.35rem 0',
          boxShadow: '0 12px 36px rgba(0,0,0,0.25)'
        }}>
          {showRespin &&
          <button
            type="button"
            onClick={() => { setOpen(false); onRespin(); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.muted, fontFamily: F.ui, fontSize: '0.95rem',
              fontWeight: 400, padding: '0.6rem 1rem'
            }}>
            Respin
          </button>
          }
          <button
            type="button"
            disabled={disableBackHome}
            onClick={() => { if (disableBackHome) return; setOpen(false); onBackHome(); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: 'none', border: 'none',
              cursor: disableBackHome ? 'not-allowed' : 'pointer',
              color: disableBackHome ? C.dim : C.text, fontFamily: F.ui, fontSize: '0.95rem',
              fontWeight: 400, padding: '0.6rem 1rem',
              opacity: disableBackHome ? 0.5 : 1
            }}>
            ← Back to home
          </button>

        </div>
        }
      </div>
    </div>
  );
}

// ─── NEXT SPEAKER CELEBRATION — spotlight bloom + rising gold dust ───────────
function seededRevealParticles(seed, count) {
  let s = seed * 9973 + 1;
  const rnd = () => { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${rnd() * 100}%`,
    bottom: `${-6 + rnd() * 30}%`,
    size: 2.5 + rnd() * 4.5,
    delay: `${rnd() * 3.2}s`,
    duration: `${4 + rnd() * 3.5}s`,
    variant: i % 3
  }));
}

function SpeakerRevealCelebration({ seed = 0 }) {
  const particles = React.useMemo(() => seededRevealParticles(seed, 28), [seed]);

  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
      {particles.map((p) =>
      <div
        key={p.id}
        style={{
          position: 'absolute',
          left: p.left,
          bottom: p.bottom,
          width: p.size * 1.6,
          height: p.size * 1.6,
          borderRadius: p.id % 3 === 0 ? 1 : '50%',
          background: p.id % 4 === 0 ? FIELD.blue : 'rgba(205,228,254,0.9)',
          animation: `dustRise${p.variant} ${p.duration} ease-in-out ${p.delay} infinite`,
          willChange: 'transform, opacity'
        }} />
      )}
    </div>
  );
}

// ─── SPEAKER ADDED CONFIRMATION ───────────────────────────────────────────────
const SPEAKER_ADDED_HOLD_MS = 2800;

function SpeakerAddedBeat({ name, added, continueAdding = false, isFirstTimer = false, onDone, suppressAddHints = false }) {
  useEffect(() => {
    const t = setTimeout(() => onDone({ continueAdding: false }), SPEAKER_ADDED_HOLD_MS);
    return () => clearTimeout(t);
  }, [name, onDone]);

  // Enter — skip confirmation and return to add next name (disabled during walk-through first add)
  useEffect(() => {
    if (suppressAddHints) return;
    let armed = false;
    const arm = setTimeout(() => { armed = true; }, 300);
    const h = (e) => {
      if (!armed || e.code !== 'Enter') return;
      e.preventDefault();
      onDone({ continueAdding: true });
    };
    window.addEventListener('keydown', h);
    return () => {
      clearTimeout(arm);
      window.removeEventListener('keydown', h);
    };
  }, [onDone, suppressAddHints]);

  const showFt = isFirstTimer && added;

  return (
    <div style={{
      background: C.bg,
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4rem 2rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          color: FIELD.blue,
          fontFamily: F.ui,
          fontSize: 'clamp(1.05rem, 1.4vw + 0.4rem, 1.3rem)',
          letterSpacing: '0.24em',
          paddingLeft: '0.24em',
          textTransform: 'uppercase',
          fontWeight: 700,
          marginBottom: 'clamp(1.5rem, 3.5vh, 2.25rem)',
          animation: 'fadeSlide 0.55s ease both'
        }}>
          {added ? "You're on the list" : 'Already registered'}
        </div>
        <div style={{
          fontFamily: F.stage,
          fontSize: 'clamp(4rem, 10vw, 9rem)',
          fontWeight: 700,
          color: FIELD.cream,
          letterSpacing: '0',
          lineHeight: 0.98,
          animation: 'fadeSlide 0.55s ease 0.1s both'
        }}>
          {name}
        </div>
        {showFt &&
        <div style={{
          marginTop: 'clamp(1.25rem, 3vh, 1.75rem)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.55rem',
          color: FIELD.blue,
          fontFamily: F.ui,
          fontSize: '0.9rem',
          fontWeight: 700,
          letterSpacing: '0.28em',
          paddingLeft: '0.28em',
          textTransform: 'uppercase',
          animation: 'firstTimerChipPulse 1s ease-out both'
        }}>
          <span aria-hidden style={{ fontSize: '0.8rem' }}>✦</span>
          First timer
        </div>
        }
        <div style={{
          marginTop: 'clamp(1.5rem, 3.5vh, 2.25rem)',
          fontFamily: F.stage,
          fontSize: 'clamp(1.6rem, 2.5vw + 0.5rem, 2.2rem)',
          fontWeight: 500,
          letterSpacing: '0',
          color: added ? FIELD.blue : 'rgba(205,228,254,0.7)',
          textTransform: 'lowercase',
          animation: 'revealQuoteIn 0.75s ease 0.55s both'
        }}>
          {added ? 'added.' : 'welcome back.'}
        </div>
        {continueAdding && !suppressAddHints &&
        <p style={{
          marginTop: 'clamp(2rem, 4vh, 2.75rem)',
          color: 'rgba(205,228,254,0.55)',
          fontFamily: F.ui,
          fontSize: '0.9rem',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          fontWeight: 500,
          animation: 'fadeSlide 0.55s ease 0.85s both',
          opacity: 0.85
        }}>
          Enter — add another{added ? ' · ⌘F — first timer' : ''}
        </p>
        }
      </div>
    </div>
  );
}

// ─── DRAWING SCREEN ───────────────────────────────────────────────────────────
function DrawingScreen({ participants, onComplete, onBackHome, pickRevealQuoteForSession, demoMode = false, onToggleDemo, onPhaseChange, walkAllow = null }) {
  const [phase, setPhase] = useState('ready');
  const [winner, setWinner] = useState(null);
  const [nameKey, setNameKey] = useState(0);
  const [revealQuote, setRevealQuote] = useState(REVEAL_QUOTES[0]);

  useEffect(() => {
    onPhaseChange && onPhaseChange(phase);
  }, [phase, onPhaseChange]);

  const remaining = participants.filter((p) => !p.done);

  // Lock the participant pool for the spin so React state changes don't reshuffle the hat mid-draw
  const [spinPool, setSpinPool] = useState([]);
  const [spinWinnerIdx, setSpinWinnerIdx] = useState(-1);
  const [spinKey, setSpinKey] = useState(0);

  const lastRevealAdvanceRef = useRef(0);

  useEffect(() => {
    if (phase === 'reveal') lastRevealAdvanceRef.current = 0;
  }, [phase, winner?.name]);

  const launchSpinFromPool = useCallback((pool, spokenCount) => {
    if (pool.length === 0) return;
    const { winner: w, winnerIdx } = pickDrawWinner(pool, spokenCount);
    if (winnerIdx < 0 || !w) return;
    setSpinPool(pool);
    setSpinWinnerIdx(winnerIdx);
    setSpinKey((k) => k + 1);
    setWinner(w);
    setPhase('spinning');
  }, []);

  const startDraw = useCallback(() => {
    if (phase !== 'ready' || remaining.length === 0) return;
    const spokenCount = participants.filter((p) => p.done).length;
    // One person left — skip the hat, go straight to Next Speaker reveal
    if (remaining.length === 1) {
      const { winner: w } = pickDrawWinner(remaining, spokenCount);
      if (!w) return;
      setWinner(w);
      setRevealQuote(pickRevealQuoteForSession());
      setNameKey((k) => k + 1);
      setPhase('reveal');
      return;
    }
    launchSpinFromPool([...remaining], spokenCount);
  }, [phase, remaining, participants, launchSpinFromPool, pickRevealQuoteForSession]);

  /** Same pool as Draw — nobody is marked done until they browse questions */
  const respinFromReveal = useCallback(() => {
    if (phase !== 'reveal' || remaining.length === 0) return;
    const spokenCount = participants.filter((p) => p.done).length;
    launchSpinFromPool([...remaining], spokenCount);
  }, [phase, remaining, participants, launchSpinFromPool]);

  const prevDemoModeRef = useRef(demoMode);

  // ⌘D swaps speaker roster — refresh locked spin pool to match
  useEffect(() => {
    if (prevDemoModeRef.current === demoMode) return;
    prevDemoModeRef.current = demoMode;

    const spokenCount = participants.filter((p) => p.done).length;
    if (remaining.length === 0) return;

    if (remaining.length === 1) {
      const { winner: w } = pickDrawWinner(remaining, spokenCount);
      if (!w) return;
      setSpinPool([...remaining]);
      setSpinWinnerIdx(0);
      setWinner(w);
      setRevealQuote(pickRevealQuoteForSession());
      setNameKey((k) => k + 1);
      setPhase('reveal');
      return;
    }

    launchSpinFromPool([...remaining], spokenCount);
  }, [demoMode, remaining, participants, launchSpinFromPool, pickRevealQuoteForSession]);

  // The hat has already presented the name — go straight to the question flow.
  // (The one-speaker shortcut still uses the reveal screen, since there is no hat.)
  const onSpinComplete = useCallback(() => {
    if (winner) onComplete({ name: winner.name });
  }, [winner, onComplete]);


  // Skip pre-draw screen — go straight to spin (or reveal if one left)
  useEffect(() => {
    if (remaining.length === 0) return;
    startDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Space on reveal → question picker (ignore repeat presses within 2s)
  useEffect(() => {
    const h = (e) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      if (phase !== 'reveal' || !winner) return;
      e.preventDefault();
      const now = Date.now();
      if (lastRevealAdvanceRef.current && now - lastRevealAdvanceRef.current < 2000) return;
      lastRevealAdvanceRef.current = now;
      onComplete({ name: winner.name });
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [phase, winner, onComplete]);

  // ⌘D / Ctrl+D — toggle demo mode (same as home screen)
  useEffect(() => {
    if (!onToggleDemo) return;
    const h = (e) => {
      if (!cmdPressed(e) || e.code !== 'KeyD') return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      onToggleDemo();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onToggleDemo]);

  const adminMenu = (
    <DrawingAdminMenu
      onBackHome={onBackHome}
      showRespin={phase === 'reveal' && remaining.length > 1}
      onRespin={respinFromReveal}
      disableBackHome={!!walkAllow}
      disableMenu={walkAllow === 'revealAdvance'}
    />
  );

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      background: phase === 'reveal'
        ? `radial-gradient(ellipse 120% 90% at 50% 18%, rgba(233,79,46,0.22) 0%, rgba(233,79,46,0.06) 45%, ${C.bg} 78%)`
        : C.bg,
      transition: 'background 0.55s ease'
    }}>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {(phase === 'spinning' || phase === 'reveal') && adminMenu}
      {/* Decorative rings (visible on Next Speaker) */}
      {phase === 'reveal' &&
      <>
        <div style={{ position: 'absolute', width: 800, height: 800, borderRadius: '50%', border: '1.5px solid rgba(205,228,254,0.2)', pointerEvents: 'none', animation: 'revealRingPulse 3s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 560, height: 560, borderRadius: '50%', border: '1.5px solid rgba(205,228,254,0.28)', pointerEvents: 'none', animation: 'revealRingPulse 3s ease-in-out 0.45s infinite' }} />
      </>
      }

      {/* ── SPINNING — the hat ── */}
      {phase === 'spinning' && spinPool.length > 0 && spinWinnerIdx >= 0 &&
      <div style={{ position: 'relative', width: '100%', flex: 1, minHeight: 0, alignSelf: 'stretch' }}>
        {window.HatDraw && React.createElement(window.HatDraw, {
          names: spinPool.map((p) => p.name),
          winnerIdx: spinWinnerIdx,
          spinKey: spinKey,
          doneCount: participants.filter((p) => p.done).length,
          onComplete: onSpinComplete
        })}
      </div>
      }

      {/* ── REVEAL (Next Speaker) — Space / Enter or button → question picker */}
      {phase === 'reveal' && winner &&
      <>
        <SpeakerRevealCelebration seed={nameKey} />
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 2 }}>
          <div style={{
          color: FIELD.blue,
          fontFamily: F.ui,
          fontSize: 'clamp(1.05rem, 1.5vw + 0.4rem, 1.35rem)',
          letterSpacing: '0.24em',
          paddingLeft: '0.24em',
          textTransform: 'uppercase',
          fontWeight: 700,
          marginBottom: 'clamp(1.5rem, 3.5vh, 2.25rem)',
          animation: 'fadeSlide 0.55s ease both'
        }}>
            Give it up for
          </div>
          <div key={nameKey} style={{
            fontFamily: F.stage,
            fontSize: 'clamp(5.5rem, 13vw, 13rem)',
            fontWeight: 700,
            color: FIELD.cream,
            letterSpacing: '0',
            lineHeight: 0.96,
            animation: 'revealEnter 0.8s cubic-bezier(0.19, 1, 0.22, 1) both'
          }}>
              {winner.name}
            </div>
          <div
            key={`${nameKey}-rule`}
            aria-hidden
            style={{
              width: 88,
              height: 2,
              margin: 'clamp(1.75rem, 3.5vh, 2.5rem) auto 0',
              background: `linear-gradient(90deg, transparent, ${FIELD.cream}, transparent)`,
              animation: 'revealRule 0.9s ease 0.4s both'
            }}
          />
          {revealQuote &&
          <p
            key={`${nameKey}-quote`}
            style={{
              maxWidth: 'min(720px, 90vw)',
              margin: 'clamp(1.5rem, 3vh, 2.25rem) auto 0',
              padding: '0 1rem',
              fontFamily: F.stage,
              fontSize: 'clamp(1.4rem, 2.1vw + 0.45rem, 1.9rem)',
              fontWeight: 500,
              lineHeight: 1.4,
              letterSpacing: '0',
              color: 'rgba(205,228,254,0.92)',
              animation: 'revealQuoteIn 0.75s ease 0.55s both'
            }}
          >
            “{revealQuote}”
          </p>
          }
          <KeyboardHint
            ariaLabel="Press space to continue"
            caption="to continue"
            style={{ marginTop: 'clamp(2rem, 4vh, 3rem)' }}
            dark
          >
            <RetroSpaceKey dark />
          </KeyboardHint>
        </div>
      </>
      }

      </div>

    </div>);

}

// ─── QUESTION SELECT SCREEN ───────────────────────────────────────────────────
function QuestionSelectScreen({
  speakerName,
  questionOfNight,
  usedQuestions,
  donePrompts = new Set(),
  onStart,
  onStartYolo,
  onBackHome,
  onRedraw,
  walkAllow = null,
  selectRestore = null,
  onSelectRestoreConsumed
}) {
  const [idx, setIdx] = useState(1);
  const [options, setOptions] = useState([]);
  const [qKey, setQKey] = useState(0);
  const didRestoreRef = useRef(false);
  const spaceGraceUntilRef = useRef(0);

  useBlockPointerInput(true);

  useEffect(() => {
    didRestoreRef.current = false;
  }, [speakerName]);

  useEffect(() => {
    if (selectRestore?.options?.length) return;
    spaceGraceUntilRef.current = Date.now() + 2000;
  }, [speakerName, selectRestore]);

  useEffect(() => {
    if (selectRestore?.options?.length && !didRestoreRef.current) {
      setOptions(selectRestore.options);
      setIdx(selectRestore.idx);
      setQKey((k) => k + 1);
      didRestoreRef.current = true;
      onSelectRestoreConsumed && onSelectRestoreConsumed();
      return;
    }
    if (didRestoreRef.current) return;
    const randoms = pickSpeakerOptions({ donePrompts, usedQuestions, questionOfNight });
    setOptions([YOLO_SLOT, questionOfNight, ...randoms]);
    setIdx(1);
    setQKey((k) => k + 1);
  }, [speakerName, questionOfNight, usedQuestions, donePrompts, selectRestore, onSelectRestoreConsumed]);

  const isYolo = options[idx] === YOLO_SLOT;
  const isQotN = options[idx] === questionOfNight;
  const current = isYolo ? '' : (options[idx] || '');

  // Guard against a keypress landing before options populate (len 0 → idx NaN, wedging the carousel)
  const goLeft = useCallback(() => {
    if (!options.length) return;
    setIdx((i) => ((Number.isInteger(i) ? i : 1) - 1 + options.length) % options.length);
    setQKey((k) => k + 1);
  }, [options.length]);
  const goRight = useCallback(() => {
    if (!options.length) return;
    setIdx((i) => ((Number.isInteger(i) ? i : 1) + 1) % options.length);
    setQKey((k) => k + 1);
  }, [options.length]);

  useEffect(() => {
    const h = (e) => {
      if (e.code === 'ArrowLeft') { e.preventDefault(); goLeft(); }
      if (e.code === 'ArrowRight') { e.preventDefault(); goRight(); }
      if (e.code === 'Space') {
        e.preventDefault();
        if (Date.now() < spaceGraceUntilRef.current) return;
        const snapshot = { options, idx };
        if (isYolo) onStartYolo(snapshot);
        else if (current) onStart(current, snapshot);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [goLeft, goRight, current, isYolo, onStart, onStartYolo, options, idx]);

  if (!options.length) return null;

  // Prompt of the night sits on the same ground as Home. Moving to a random
  // prompt shifts the room into deep navy with a low blue glow from the floor;
  // Yolo turns the lights red. Nothing here should read as light coming in.
  const questionSelectBackdrop = isYolo
    ? YOLO_BACKDROP
    : isQotN
    ? C.bg
    : 'radial-gradient(ellipse 100% 62% at 50% 112%, rgba(86,150,210,0.24) 0%, rgba(86,150,210,0.07) 45%, transparent 72%), linear-gradient(180deg, #0B1322 0%, #0A0F1B 55%, #080B12 100%)';

  const dotColor = (i) => {
    if (i !== idx) return 'rgba(205,228,254,0.35)';
    if (options[i] === YOLO_SLOT) return FIELD.vermilion;
    if (options[i] === questionOfNight) return FIELD.sky;
    return C.text;
  };

  return (
    <div style={{
      background: questionSelectBackdrop,
      transition: 'background 0.8s ease',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 6rem',
      position: 'relative'
    }}>
      {isYolo && <YoloGlow />}
      {onBackHome &&
      <DrawingAdminMenu
        onBackHome={onBackHome}
        showRespin={!!onRedraw}
        onRespin={onRedraw}
        disableBackHome={!!walkAllow}
        disableMenu={!!walkAllow}
      />
      }

      {/* Badge + pager — top centre */}
      <div style={{
        position: 'absolute',
        top: '2.5rem',
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        zIndex: 2
      }}>
        {isQotN ?
        <QuestionOfNightBadge text={questionOfNight} />
        : isYolo ?
        <YoloModeBadge />
        : current ?
        <Badge tone="quiet">
          Random {promptNoun(current)} {idx - 1}
        </Badge>
        : null
        }

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          {options.map((_, i) =>
          <div key={i} aria-hidden style={{
            width: i === idx ? 28 : 8, height: 8, borderRadius: 100,
            background: dotColor(i),
            transition: 'all 0.25s'
          }} />
          )}
        </div>
      </div>

      {/* Question text or Yolo graphic */}
      {isYolo ?
      <div
        key={qKey}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 'clamp(12rem, 18vh, 15rem)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(7.5rem, 12vh, 9.5rem) 3rem 0',
          animation: 'fadeSlide 0.22s ease-out'
        }}>
        <div style={{
          position: 'relative',
          width: 'clamp(9rem, 22vw, 16rem)',
          height: 'clamp(9rem, 22vw, 16rem)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2px solid rgba(233,79,46,0.85)',
            boxShadow: '0 0 40px rgba(233,79,46,0.35), inset 0 0 40px rgba(233,79,46,0.18)',
            background: 'rgba(233,79,46,0.06)',
            animation: 'yoloPulse 2.8s ease-in-out infinite'
          }} />
          <div style={{
            fontFamily: F.stage,
            fontSize: 'clamp(6rem, 14vw, 10rem)',
            fontWeight: 700,
            color: FIELD.cream,
            lineHeight: 1,
            textShadow: '0 0 36px rgba(233,79,46,0.7), 0 0 90px rgba(233,79,46,0.35)',
            animation: 'yoloPulse 2.8s ease-in-out infinite',
            userSelect: 'none'
          }} aria-hidden>
            ?
          </div>
        </div>
      </div>
      :
      <QuestionDisplayText
        key={qKey}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 'clamp(12rem, 18vh, 15rem)',
          alignItems: 'center',
          padding: 'clamp(7.5rem, 12vh, 9.5rem) 3rem 0',
          color: C.text,
          animation: 'fadeSlide 0.22s ease-out'
        }}>
        {current}
      </QuestionDisplayText>
      }

      {/* Keyboard hints */}
      <div style={{
        position: 'absolute',
        bottom: 'clamp(1.5rem, 3vh, 2.5rem)',
        left: 'clamp(1rem, 3vw, 2rem)',
        right: 'clamp(1rem, 3vw, 2rem)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 'clamp(2rem, 5vw, 3.5rem)',
        zIndex: 3
      }}>
        <KeyboardHint ariaLabel="Arrow keys to browse prompts" caption="to browse prompts" dark>
          <RetroArrowKeys dark />
        </KeyboardHint>
        <KeyboardHint
          ariaLabel={isYolo ? 'Press space to accept the challenge' : 'Press space to start speech'}
          caption={isYolo ? 'to accept the challenge' : 'to start speech'}
          dark
        >
          <RetroSpaceKey dark />
        </KeyboardHint>
      </div>
    </div>);

}

// ─── YOLO PREP SCREEN ─────────────────────────────────────────────────────────
function YoloPrepScreen({ question, demoMode = false, onComplete, onCancel }) {
  const [phase, setPhase] = useState('tease');
  const [countdown, setCountdown] = useState(null);

  const suspenseMs = demoMode ? 1400 : 2600;
  const revealAnimMs = demoMode ? 900 : 1500;
  const prepCount = 5;

  useBlockPointerInput(true);

  // Tease → reveal (question begins fading in)
  useEffect(() => {
    if (phase !== 'tease') return;
    const t = setTimeout(() => setPhase('reveal'), suspenseMs);
    return () => clearTimeout(t);
  }, [phase, suspenseMs]);

  // Reveal animation completes → start countdown
  useEffect(() => {
    if (phase !== 'reveal') return;
    const t = setTimeout(() => {
      setPhase('countdown');
      setCountdown(prepCount);
    }, revealAnimMs);
    return () => clearTimeout(t);
  }, [phase, revealAnimMs, prepCount]);

  // Countdown ticks; at zero → speech timer
  useEffect(() => {
    if (phase !== 'countdown' || countdown === null) return;
    if (countdown <= 0) {
      onComplete();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown, onComplete]);

  useEffect(() => {
    const h = (e) => {
      if (e.code !== 'Escape') return;
      e.preventDefault();
      onCancel();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onCancel]);

  const showTease = phase === 'tease';
  const showQuestion = phase === 'reveal' || phase === 'countdown';
  const showCountdown = phase === 'countdown';

  return (
    <div style={{
      background: YOLO_BACKDROP,
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 4rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <YoloGlow still />
      <div style={{ position: 'absolute', top: '2.5rem', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 2 }}>
        <YoloModeBadge />
      </div>

      {showTease &&
      <div style={{
        color: 'rgba(205,228,254,0.82)',
        fontFamily: F.ui,
        fontSize: 'clamp(1.5rem, 2.8vw, 2rem)',
        fontWeight: 700,
        letterSpacing: '0.18em',
        paddingLeft: '0.18em',
        textTransform: 'uppercase',
        userSelect: 'none'
      }}>
        Your {promptNoun(question)}…
      </div>
      }

      {showQuestion &&
      <QuestionDisplayText
        style={{
          maxWidth: 1500,
          padding: '0 2rem',
          color: FIELD.cream,
          marginBottom: showCountdown ? 'clamp(2rem, 5vh, 3.5rem)' : 0,
          animation: phase === 'reveal'
            ? `yoloQuestionReveal ${revealAnimMs}ms cubic-bezier(0.22, 1, 0.36, 1) both`
            : undefined,
          opacity: phase === 'countdown' ? 1 : undefined
        }}>
        {question}
      </QuestionDisplayText>
      }

      {showCountdown && countdown !== null && countdown > 0 &&
      <div
        key={countdown}
        style={{
          fontFamily: F.ui,
          fontSize: 'clamp(8rem, 22vw, 15rem)',
          fontWeight: 900,
          color: FIELD.vermilion,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          userSelect: 'none'
        }}>
        {countdown}
      </div>
      }

    </div>
  );
}

// ─── SPEECH SCREEN ────────────────────────────────────────────────────────────
function SpeechScreen({ speakerName, question, onComplete, onBackToQuestions, demoMode = false, onPhaseChange, requireFullSpeech = false, onFullTimeReached }) {
  const [phase, setPhase] = useState('speech');
  const [speechSecs, setSpeechSecs] = useState(0);
  const [feedSecs, setFeedSecs] = useState(0);
  const [flashOn, setFlashOn] = useState(false);
  const [timerFastForward, setTimerFastForward] = useState(false);
  const phaseRef = useRef('speech');
  const speechSecsRef = useRef(0);

  useEffect(() => {
    onPhaseChange && onPhaseChange(phase);
  }, [phase, onPhaseChange]);
  phaseRef.current = phase;
  speechSecsRef.current = speechSecs;

  // Speech timer — normal mode
  useEffect(() => {
    if (phase !== 'speech' || demoMode) return;
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
  }, [phase, demoMode]);

  // Speech timer — demo mode: jump to milestones, count +5s at 1:00 & 1:30, then hold at 2:00 (manual → feedback)
  useEffect(() => {
    if (phase !== 'speech' || !demoMode) return;
    setSpeechSecs(0);
    setTimerFastForward(false);

    const cleanups = [];
    let cancelled = false;
    const addCleanup = (fn) => cleanups.push(fn);

    const countFor = (durationSec, fromSecs, onDone) => {
      const start = performance.now();
      let raf;
      const tick = (now) => {
        if (cancelled) return;
        const elapsed = (now - start) / 1000;
        if (elapsed >= durationSec) {
          setSpeechSecs(fromSecs + durationSec);
          onDone();
          return;
        }
        setSpeechSecs(fromSecs + elapsed);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      addCleanup(() => cancelAnimationFrame(raf));
    };

    const jumpTo = (from, to, onDone) => {
      if (cancelled) return;
      setTimerFastForward(true);
      addCleanup(animateSecs(from, to, 720, (v) => setSpeechSecs(v), () => {
        if (cancelled) return;
        setTimerFastForward(false);
        setSpeechSecs(to);
        onDone();
      }));
    };

    const holdFor = (secs, at, onDone) => {
      const t = setTimeout(() => {
        if (cancelled) return;
        setSpeechSecs(at);
        onDone();
      }, secs * 1000);
      addCleanup(() => clearTimeout(t));
    };

    // 0→0:05 → jump 1:00 → count to 1:05 → jump 1:30 → count to 1:35 → jump 2:00 → hold → count on (Space → feedback)
    countFor(5, 0, () => {
      jumpTo(5, 60, () => {
        countFor(5, 60, () => {
          jumpTo(65, 90, () => {
            countFor(5, 90, () => {
              jumpTo(95, 120, () => {
                holdFor(5, 120, () => {
                  if (cancelled) return;
                  const resumeStart = Date.now();
                  let raf;
                  const resumeTick = () => {
                    if (cancelled) return;
                    setSpeechSecs(120 + (Date.now() - resumeStart) / 1000);
                    raf = requestAnimationFrame(resumeTick);
                  };
                  raf = requestAnimationFrame(resumeTick);
                  addCleanup(() => cancelAnimationFrame(raf));
                });
              });
            });
          });
        });
      });
    });

    return () => {
      cancelled = true;
      cleanups.forEach((c) => c());
    };
  }, [phase, demoMode]);

  // Feedback timer — counts up to 2:00 then alarm (demo + real)
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

  // Smooth jazz when speech runs over 2:00
  useEffect(() => {
    if (phase !== 'speech' || speechSecs < 120) return;
    return startJazzAlarmLoop();
  }, [phase, speechSecs >= 120]);

  // Smooth jazz when feedback runs out (alarm phase)
  useEffect(() => {
    if (phase !== 'alarm') return;
    return startJazzAlarmLoop();
  }, [phase]);

  // Over-time flash
  useEffect(() => {
    if (phase !== 'speech' || speechSecs < 120) return;
    const id = setInterval(() => setFlashOn((f) => !f), 500);
    return () => clearInterval(id);
  }, [phase, speechSecs >= 120]);

  // Notify once the speech timer reaches the 2:00 mark (used by the walk-through).
  useEffect(() => {
    if (phase === 'speech' && speechSecs >= 120) onFullTimeReached && onFullTimeReached();
  }, [phase, speechSecs >= 120]);

  // Key handler — Space advances state machine; Escape returns to question browse (speech or feedback)
  useEffect(() => {
    const h = (e) => {
      if (e.code === 'Escape') {
        if ((phaseRef.current !== 'speech' && phaseRef.current !== 'feedback') || !onBackToQuestions) return;
        e.preventDefault();
        onBackToQuestions();
        return;
      }
      if (e.code !== 'Space') return;
      e.preventDefault();
      const p = phaseRef.current;
      if (p === 'speech') {
        // During the walk-through, hold the speaker on the timer until it reaches the 2:00
        // mark so the host sees every colour state before Space ends the speech.
        if (requireFullSpeech && speechSecsRef.current < 120) return;
        setPhase('feedback');setFeedSecs(0);
      } else
      if (p === 'feedback') {onComplete();} // manual skip → straight to draw
      else if (p === 'alarm') {onComplete();} // timeout alarm → draw
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onComplete, onBackToQuestions, requireFullSpeech]);

  // ── derive visuals — the whole field changes colour as time runs down ──
  let bgColor = C.bg;
  if (phase === 'speech') {
    if (speechSecs >= 120) bgColor = flashOn ? '#4A0E05' : '#2A0803';else
    if (speechSecs >= 90) bgColor = '#2A0A03';else
    if (speechSecs >= 60) bgColor = '#1F1206';
  } else if (phase === 'feedback') {
    bgColor = '#0C1119';
  } else if (phase === 'alarm') {
    bgColor = '#1E0602';
  }

  const hotField = phase === 'alarm' || (phase === 'speech' && speechSecs >= 90);
  let timerColor = C.text;
  if (phase === 'speech') {
    if (speechSecs >= 90) timerColor = FIELD.cream;else
    if (speechSecs >= 60) timerColor = C.text;
  }

  const feedLeft = Math.max(0, 120 - feedSecs);

  return (
    <div style={{
      background: bgColor, height: '100vh', display: 'flex', flexDirection: 'column',
      transition: 'background 1.2s ease', overflow: 'hidden', position: 'relative'
    }}>

      {/* ── ALARM ── */}
      {phase === 'alarm' &&
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '4rem'
      }}>
          <div style={{
          fontFamily: F.stage,
          fontSize: 'clamp(4rem, 9vw, 8.5rem)',
          fontWeight: 700, color: FIELD.cream,
          letterSpacing: '0', lineHeight: 1.08,
          animation: 'pulseBig 0.9s ease-in-out infinite'
        }}>
            Next speaker, please
          </div>
          <KeyboardHint
            ariaLabel="Press space to continue"
            caption="to continue"
            style={{ marginTop: '2.5rem' }}
            dark
          >
            <RetroSpaceKey dark />
          </KeyboardHint>
        </div>
      }

      {/* ── SPEECH + FEEDBACK ── */}
      {phase !== 'alarm' &&
      <>
          {/* Question header */}
          <div style={{
          flexShrink: 0,
          padding: 'clamp(1.25rem, 2.5vh, 1.75rem) clamp(2rem, 4vw, 3rem) clamp(1.25rem, 2.5vh, 1.75rem)',
          display: 'flex', justifyContent: 'center',
          borderBottom: `1px solid ${hotField ? 'rgba(205,228,254,0.3)' : C.borderSoft}`
        }}>
            <div style={{
              maxWidth: 'min(1280px, 94%)',
              width: '100%',
              minWidth: 0,
              textAlign: 'center'
            }}>
              <div style={{
              color: hotField ? FIELD.cream : C.text,
              fontFamily: F.stage,
              fontSize: 'clamp(3.2rem, 5.2vw + 1.2rem, 5rem)',
              lineHeight: 1.15,
              fontWeight: 700,
              letterSpacing: '0.015em',
              textWrap: 'balance',
              transition: 'color 0.8s ease',
              overflowWrap: 'break-word'
            }}>
                {question}
              </div>
            </div>
          </div>

          {/* Timer stage — fills space between question and Space hint */}
          <div style={{
            flex: 1,
            minHeight: 0,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: 'clamp(1rem, 2.5vh, 2rem) clamp(1.5rem, 4vw, 3rem)'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'clamp(1.25rem, 3vh, 2rem)'
            }}>
              {phase === 'feedback' && <FeedbackBadge large />}

              <div style={{
                fontFamily: F.ui,
                fontSize: 'clamp(8.5rem, 20vw, 21rem)',
                fontWeight: 700,
                color: phase === 'feedback'
                  ? (feedLeft < 30 ? FIELD.vermilion : FIELD.blue)
                  : timerColor,
                letterSpacing: '-0.025em',
                lineHeight: 0.9,
                fontVariantNumeric: 'tabular-nums',
                transition: timerFastForward ? 'color 0.35s ease' : 'color 0.8s ease',
                transform: timerFastForward ? 'scale(1.02)' : 'scale(1)',
                filter: timerFastForward ? 'brightness(1.06)' : 'none',
                userSelect: 'none'
              }}>
                {phase === 'feedback' ? fmt(feedLeft) : fmt(speechSecs)}
              </div>

              <div style={{
                minHeight: 'clamp(2rem, 4vh, 2.75rem)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: F.ui
              }}>
                {phase === 'speech' && speechSecs >= 60 && speechSecs < 90 &&
                <div style={{ color: C.text, fontSize: '1.85rem', fontWeight: 700, letterSpacing: '0.22em', paddingLeft: '0.22em' }}>
                  ONE MINUTE
                </div>
                }
                {phase === 'speech' && speechSecs >= 90 && speechSecs < 120 &&
                <div style={{ color: FIELD.cream, fontSize: '1.85rem', fontWeight: 700, letterSpacing: '0.22em', paddingLeft: '0.22em' }}>
                  WRAP IT UP SOON
                </div>
                }
                {phase === 'speech' && speechSecs >= 120 &&
                <div style={{ color: FIELD.cream, fontSize: '2rem', fontWeight: 900, letterSpacing: '0.22em', paddingLeft: '0.22em', animation: 'pulseBig 0.9s ease-in-out infinite' }}>
                  TIME'S UP
                </div>
                }
                {phase === 'feedback' && feedLeft < 30 &&
                <div style={{ color: FIELD.vermilion, fontSize: '1.85rem', fontWeight: 700, letterSpacing: '0.22em', paddingLeft: '0.22em' }}>
                  ALMOST DONE
                </div>
                }
              </div>
            </div>
          </div>

          {/* Space hint */}
          <div style={{
            flexShrink: 0,
            padding: 'clamp(1.25rem, 3vh, 2rem) clamp(1rem, 3vw, 2rem) clamp(1.75rem, 4vh, 3rem)',
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}>
            <KeyboardHint
              ariaLabel={phase === 'speech' ? 'Press space to end speech' : 'Press space to finish feedback'}
              caption={phase === 'speech' ? 'to end speech' : 'to finish feedback'}
              dark={hotField}
            >
              <RetroSpaceKey dark={hotField} />
            </KeyboardHint>
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
  YoloPrepScreen,
  SpeechScreen,
  QRScreen,
  WalkthroughCoach,
  WalkthroughIntroModal,
  WalkthroughRestartButton,
  SpeakerAddedBeat,
  YOLO_SLOT,
  // Prompt selection (shared with app.jsx)
  eligiblePrompts,
  pickSpeakerOptions,
  pickYoloPrompt,
  // Shared primitives for the hat draw (tophat.jsx)
  KeyboardHint,
  RetroSpaceKey,
  APS_THEME: { C, F }
});