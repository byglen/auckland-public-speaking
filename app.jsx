// app.jsx — main state machine for Auckland Public Speaking
const { useState, useEffect, useCallback, useRef } = React;

// Demo speakers — clearly fictional / famous figures (never real attendee names)
const DEMO_SPEAKER_NAMES = [
  'Sherlock', 'Gandalf', 'Ringo', 'Spock', 'Yoda',
  'Paddington', 'Pikachu', 'Snoopy', 'Tintin', 'Shrek',
  'Bowie', 'Gatsby', 'Picasso', 'Mozart'
];

const SCREEN = {
  SETUP:    'setup',
  HOME:     'home',
  REGISTER: 'register',
  DRAWING:  'drawing',
  QSELECT:  'qselect',
  SPEECH:   'speech',
  QR:       'qr',
};

function App() {
  const [screen,          setScreen]          = useState(SCREEN.SETUP);
  const [questionOfNight, setQuestionOfNight] = useState('');
  const [participants,    setParticipants]    = useState([]);
  const [currentSpeaker,  setCurrentSpeaker]  = useState(null);
  const [usedQuestions,   setUsedQuestions]   = useState(new Set());
  const [selectedQ,       setSelectedQ]       = useState(null);
  const [registerSeed,    setRegisterSeed]    = useState('');
  const [demoMode,        setDemoMode]        = useState(false);
  const [addedFlash,      setAddedFlash]      = useState(null);
  const [reopenManage,    setReopenManage]    = useState(false);
  const [questionSelectState, setQuestionSelectState] = useState(null);
  const [usedRevealQuotes, setUsedRevealQuotes] = useState(new Set());
  const usedRevealQuotesRef = useRef(usedRevealQuotes);
  usedRevealQuotesRef.current = usedRevealQuotes;
  const realParticipantsRef = useRef([]);
  const lastAddedParticipantRef = useRef(null);
  const firstTimerPulseTimerRef = useRef(null);
  const [firstTimerPulseName, setFirstTimerPulseName] = useState(null);

  const pickRevealQuoteForSession = useCallback(() => {
    const quote = pickRevealQuote(usedRevealQuotesRef.current);
    setUsedRevealQuotes((prev) => new Set([...prev, quote]));
    return quote;
  }, []);

  const remaining = participants.filter(p => !p.done);

  // Space on home → draw
  useEffect(() => {
    if (screen !== SCREEN.HOME) return;
    const h = e => {
      if (e.code === 'Space' && remaining.length > 0) {
        e.preventDefault();
        setScreen(SCREEN.DRAWING);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [screen, remaining.length]);

  const handleSetupDone = useCallback(q => {
    setQuestionOfNight(q);
    setScreen(SCREEN.HOME);
  }, []);

  const handleAddParticipant = useCallback((name, returnTo = null) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    let added = false;
    setParticipants(prev => {
      if (prev.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) return prev;
      added = true;
      lastAddedParticipantRef.current = trimmed;
      return [...prev, { name: trimmed, done: false, firstTimer: false }];
    });
    setAddedFlash({ name: trimmed, added, returnTo });
    return added;
  }, []);

  const dismissAddedFlash = useCallback(({ continueAdding = false } = {}) => {
    setAddedFlash((flash) => {
      if (!flash) return null;
      const { returnTo } = flash;
      setTimeout(() => {
        if (continueAdding && returnTo === 'register') {
          setRegisterSeed('');
          setScreen(SCREEN.REGISTER);
        } else if (continueAdding && returnTo === 'manage') {
          setScreen(SCREEN.HOME);
          setReopenManage(true);
        } else {
          setRegisterSeed('');
          setScreen(SCREEN.HOME);
        }
      }, 0);
      return null;
    });
  }, []);

  const handleRemoveParticipant = useCallback(name => {
    setParticipants(prev => prev.filter(p => p.name !== name));
  }, []);

  const handleSetParticipantDone = useCallback((name, done) => {
    setParticipants(prev =>
      prev.map(p => {
        if (p.name !== name) return p;
        if (done) return { ...p, done: true };
        return { ...p, done: false, firstTimer: false };
      })
    );
  }, []);

  const triggerFirstTimerPulse = useCallback((name) => {
    if (!name) return;
    if (firstTimerPulseTimerRef.current) clearTimeout(firstTimerPulseTimerRef.current);
    setFirstTimerPulseName(name);
    firstTimerPulseTimerRef.current = setTimeout(() => {
      setFirstTimerPulseName((current) => (current === name ? null : current));
      firstTimerPulseTimerRef.current = null;
    }, 1000);
  }, []);

  const handleSetParticipantFirstTimer = useCallback((name, firstTimer) => {
    setParticipants((prev) => {
      const p = prev.find((x) => x.name === name);
      if (!p) return prev;
      if (firstTimer && !p.firstTimer && !p.done) {
        queueMicrotask(() => triggerFirstTimerPulse(name));
      }
      return prev.map((x) => x.name === name ? { ...x, firstTimer: !!firstTimer } : x);
    });
  }, [triggerFirstTimerPulse]);

  const handleMarkLastAddedFirstTimer = useCallback(() => {
    const name = lastAddedParticipantRef.current;
    if (!name) return;
    setParticipants((prev) => {
      const p = prev.find((x) => x.name === name);
      if (!p || p.done) return prev;
      if (!p.firstTimer) queueMicrotask(() => triggerFirstTimerPulse(name));
      return prev.map((x) => x.name === name ? { ...x, firstTimer: true } : x);
    });
  }, [triggerFirstTimerPulse]);

  // ⌘F — mark last added speaker as first timer (home + registration)
  useEffect(() => {
    if (screen !== SCREEN.HOME && screen !== SCREEN.REGISTER) return;
    const h = (e) => {
      if (!e.metaKey || e.code !== 'KeyF') return;
      e.preventDefault();
      handleMarkLastAddedFirstTimer();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [screen, handleMarkLastAddedFirstTimer]);

  const handleResetSpeakers = useCallback(() => {
    setParticipants(prev => prev.map(p => ({ ...p, done: false, firstTimer: false })));
  }, []);

  const handleToggleDemo = useCallback(() => {
    setDemoMode((wasDemo) => {
      if (!wasDemo) {
        setParticipants((current) => {
          realParticipantsRef.current = current.map((p) => ({ ...p }));
          return DEMO_SPEAKER_NAMES.map((name) => ({ name, done: false }));
        });
        return true;
      }
      setParticipants((realParticipantsRef.current ?? []).map((p) => ({ ...p })));
      return false;
    });
  }, []);

  const handleDrawComplete = useCallback(({ name }) => {
    setCurrentSpeaker(name);
    setQuestionSelectState(null);
    setScreen(SCREEN.QSELECT);
  }, []);

  const handleSpeechStart = useCallback((question, selectSnapshot) => {
    setQuestionSelectState(selectSnapshot);
    setSelectedQ(question);
    setUsedQuestions((prev) => new Set([...prev, question]));
    setScreen(SCREEN.SPEECH);
  }, []);

  const handleSpeechBack = useCallback(() => {
    setUsedQuestions((prev) => {
      const next = new Set(prev);
      if (selectedQ) next.delete(selectedQ);
      return next;
    });
    setSelectedQ(null);
    setScreen(SCREEN.QSELECT);
  }, [selectedQ]);

  const handleSelectRestoreConsumed = useCallback(() => {
    setQuestionSelectState(null);
  }, []);

  const handleSpeechComplete = useCallback(() => {
    setParticipants(prev => {
      const updated = prev.map(p =>
        p.name === currentSpeaker ? { ...p, done: true } : p
      );
      // Go to Draw if anyone is left, otherwise Home
      const stillRemaining = updated.filter(p => !p.done);
      setTimeout(() => {
        setScreen(stillRemaining.length > 0 ? SCREEN.DRAWING : SCREEN.HOME);
      }, 0);
      return updated;
    });
    setCurrentSpeaker(null);
    setSelectedQ(null);
  }, [currentSpeaker]);

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif" }}>
      {screen === SCREEN.SETUP && (
        <SetupScreen onComplete={handleSetupDone} />
      )}
      {screen === SCREEN.HOME && (
        <HomeScreen
          questionOfNight={questionOfNight}
          participants={participants}
          firstTimerPulseName={firstTimerPulseName}
          demoMode={demoMode}
          onRegister={(seed) => { setRegisterSeed(seed || ''); setScreen(SCREEN.REGISTER); }}
          onDraw={() => setScreen(SCREEN.DRAWING)}
          onEditQuestion={() => setScreen(SCREEN.SETUP)}
          onShowQR={() => setScreen(SCREEN.QR)}
          onToggleDemo={handleToggleDemo}
          onAddParticipant={handleAddParticipant}
          onRemoveParticipant={handleRemoveParticipant}
          onSetParticipantDone={handleSetParticipantDone}
          onSetParticipantFirstTimer={handleSetParticipantFirstTimer}
          onResetSpeakers={handleResetSpeakers}
          reopenManage={reopenManage}
          onReopenManageConsumed={() => setReopenManage(false)}
        />
      )}
      {screen === SCREEN.REGISTER && (
        <RegistrationScreen
          initialChar={registerSeed}
          onAdd={(name) => handleAddParticipant(name, 'register')}
          onDone={() => { setRegisterSeed(''); setScreen(SCREEN.HOME); }}
        />
      )}
      {screen === SCREEN.QR && (
        <QRScreen onBack={() => setScreen(SCREEN.HOME)} />
      )}
      {screen === SCREEN.DRAWING && (
        <DrawingScreen
          participants={participants}
          onComplete={handleDrawComplete}
          onBackHome={() => setScreen(SCREEN.HOME)}
          pickRevealQuoteForSession={pickRevealQuoteForSession}
          demoMode={demoMode}
          onToggleDemo={handleToggleDemo}
        />
      )}
      {screen === SCREEN.QSELECT && (
        <QuestionSelectScreen
          speakerName={currentSpeaker}
          questionOfNight={questionOfNight}
          usedQuestions={usedQuestions}
          onStart={handleSpeechStart}
          selectRestore={questionSelectState}
          onSelectRestoreConsumed={handleSelectRestoreConsumed}
        />
      )}
      {screen === SCREEN.SPEECH && (
        <SpeechScreen
          speakerName={currentSpeaker}
          question={selectedQ}
          demoMode={demoMode}
          onComplete={handleSpeechComplete}
          onBackToQuestions={handleSpeechBack}
        />
      )}
      {addedFlash && window.SpeakerAddedBeat &&
      <div style={{ position: 'fixed', inset: 0, zIndex: 500 }}>
        {React.createElement(window.SpeakerAddedBeat, {
          name: addedFlash.name,
          added: addedFlash.added,
          continueAdding: !!addedFlash.returnTo,
          onDone: dismissAddedFlash
        })}
      </div>
      }
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
