// app.jsx — main state machine for Auckland Public Speaking
const { useState, useEffect, useCallback } = React;

// First names only — varied lengths + English / Indian / South Asian mix (demo shortcut)
const DEMO_SPEAKER_NAMES = [
  'Tom', 'Priya', 'Mohammed', 'Zara', 'Ananya',
  'Leo', 'Kavya', 'Fatima', 'Rohan', 'Eleanor',
  'Raj', 'Aisha', 'Ishaan', 'Naveen', 'Charlotte',
  'Vihaan', 'Tariq', 'Saanvi', 'Oliver', 'Dilshan'
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

  const handleAddParticipant = useCallback(name => {
    setParticipants(prev => {
      if (prev.some(p => p.name.toLowerCase() === name.toLowerCase())) return prev;
      return [...prev, { name, done: false }];
    });
  }, []);

  const handleRemoveParticipant = useCallback(name => {
    setParticipants(prev => prev.filter(p => p.name !== name));
  }, []);

  const handleResetSpeakers = useCallback(() => {
    setParticipants(prev => prev.map(p => ({ ...p, done: false })));
  }, []);

  const handleLoadDemoSpeakers = useCallback(() => {
    setParticipants(DEMO_SPEAKER_NAMES.map((name) => ({ name, done: false })));
  }, []);

  // Late arrivals — can be added from Draw screen
  const handleAddLate = useCallback(name => {
    setParticipants(prev => {
      if (prev.some(p => p.name.toLowerCase() === name.toLowerCase())) return prev;
      return [...prev, { name, done: false }];
    });
  }, []);

  const handleDrawComplete = useCallback(name => {
    setCurrentSpeaker(name);
    setScreen(SCREEN.QSELECT);
  }, []);

  const handleSpeechStart = useCallback(question => {
    setSelectedQ(question);
    setUsedQuestions(prev => new Set([...prev, question]));
    setScreen(SCREEN.SPEECH);
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
          onRegister={(seed) => { setRegisterSeed(seed || ''); setScreen(SCREEN.REGISTER); }}
          onDraw={() => setScreen(SCREEN.DRAWING)}
          onEditQuestion={() => setScreen(SCREEN.SETUP)}
          onShowQR={() => setScreen(SCREEN.QR)}
          onResetSpeakers={handleResetSpeakers}
          onLoadDemoSpeakers={handleLoadDemoSpeakers}
        />
      )}
      {screen === SCREEN.REGISTER && (
        <RegistrationScreen
          initialChar={registerSeed}
          onAdd={handleAddParticipant}
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
          onAddLate={handleAddLate}
          onRemoveParticipant={handleRemoveParticipant}
          onBackHome={() => setScreen(SCREEN.HOME)}
        />
      )}
      {screen === SCREEN.QSELECT && (
        <QuestionSelectScreen
          speakerName={currentSpeaker}
          questionOfNight={questionOfNight}
          usedQuestions={usedQuestions}
          onStart={handleSpeechStart}
        />
      )}
      {screen === SCREEN.SPEECH && (
        <SpeechScreen
          speakerName={currentSpeaker}
          question={selectedQ}
          onComplete={handleSpeechComplete}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
