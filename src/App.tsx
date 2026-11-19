import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HudOverlay } from './components/HudOverlay';
import { LeaderboardDrawer } from './components/LeaderboardDrawer';
import { RunSummary, StatusModal } from './components/StatusModal';
import { TitleOverlay } from './components/TitleOverlay';
import { audioEngine } from './game/audioEngine';
import { UnifiedInputManager } from './game/inputManager';
import {
  buildSongSchedule,
  computeAccuracyPercent,
  computeHitPoints,
  evaluateNoteHit,
  GameMode,
  GamePhase,
  matchSongSequence,
  NoteId,
  OCARINA_SONGS,
  OcarinaSong,
  ScheduledBeatNote,
  TIMING_WINDOW_GOOD,
} from './game/musicData';
import { CameraFocusMode, OcarinaSceneController } from './game/ocarinaScene';
import {
  LeaderboardEntry,
  signInWithGoogle,
  signOutUser,
  submitCloudScore,
  subscribeAuthUser,
  subscribeGlobalLeaderboard,
  updatePlayerNickname,
} from './services/leaderboardService';

const LOCAL_BEST_KEY = 'ocarina_sim_best_score';
const LOCAL_NAME_KEY = 'ocarina_sim_player_name';
const MAX_HALF_HEARTS = 10; // 5 full Zelda-style hearts
const PIXELS_PER_SEC = 220;
const HIT_CURSOR_X = 76;

function readInitialBest(): number {
  try {
    return Number(localStorage.getItem(LOCAL_BEST_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

function readInitialName(): string {
  try {
    return localStorage.getItem(LOCAL_NAME_KEY) || 'Músico de Hyrule';
  } catch {
    return 'Músico de Hyrule';
  }
}

function OcarinaGame() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const staffTrackRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<OcarinaSceneController | null>(null);
  const inputRef = useRef<UnifiedInputManager | null>(null);

  const [phase, setPhase] = useState<GamePhase>('title');
  const [mode, setMode] = useState<GameMode>('desafio');
  const [scoreboardOpen, setScoreboardOpen] = useState(false);

  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [hearts, setHearts] = useState(MAX_HALF_HEARTS);
  const [songIndex, setSongIndex] = useState(0);
  const [schedule, setSchedule] = useState<ScheduledBeatNote[]>(() =>
    buildSongSchedule(OCARINA_SONGS[0], 1.6, 0.9),
  );
  const [heldNotes, setHeldNotes] = useState<NoteId[]>([]);
  const [semitoneShift, setSemitoneShift] = useState(0);
  const [lastFeedback, setLastFeedback] = useState<{ grade: 'perfeito' | 'bom' | 'erro'; id: number } | null>(null);
  const [recognizedSong, setRecognizedSong] = useState<OcarinaSong | null>(null);
  const [recentFreeNotes, setRecentFreeNotes] = useState<NoteId[]>([]);
  const [muted, setMuted] = useState(false);
  const [gamepadName, setGamepadName] = useState<string | null>(null);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);

  const [bestLocalScore, setBestLocalScore] = useState<number>(readInitialBest);
  const [playerName, setPlayerName] = useState<string>(readInitialName);
  const [user, setUser] = useState<User | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [cloudStatusMsg, setCloudStatusMsg] = useState<string | null>(null);

  // Mutable simulation refs so 60Hz loop & callbacks never stale-close
  const simRef = useRef({
    phase: 'title' as GamePhase,
    mode: 'desafio' as GameMode,
    score: 0,
    combo: 0,
    bestCombo: 0,
    hearts: MAX_HALF_HEARTS,
    perfectCount: 0,
    goodCount: 0,
    missCount: 0,
    songsCompleted: 0,
    songIndex: 0,
    songTimeSec: 0,
    semitoneShift: 0,
    heldSet: new Set<NoteId>(),
    schedule: buildSongSchedule(OCARINA_SONGS[0], 1.6, 0.9),
    recentFreeNotes: [] as NoteId[],
    feedbackCounter: 0,
    scoreboardOpen: false,
    playerName: readInitialName(),
  });

  // Sync body[data-state] and camera focus mode
  useEffect(() => {
    document.body.dataset.state = phase;
    simRef.current.phase = phase;
    const camMode: CameraFocusMode = scoreboardOpen
      ? 'scoreboard'
      : phase === 'title'
        ? 'title'
        : 'playing';
    sceneRef.current?.setCameraMode(camMode);
  }, [phase, scoreboardOpen]);

  useEffect(() => {
    simRef.current.mode = mode;
  }, [mode]);

  useEffect(() => {
    simRef.current.scoreboardOpen = scoreboardOpen;
  }, [scoreboardOpen]);

  useEffect(() => {
    simRef.current.playerName = playerName;
    try {
      localStorage.setItem(LOCAL_NAME_KEY, playerName);
    } catch {
      // Ignore storage quota errors
    }
  }, [playerName]);

  const finishRun = useCallback((victory: boolean) => {
    const s = simRef.current;
    const total = s.perfectCount + s.goodCount + s.missCount;
    const accuracy = computeAccuracyPercent(s.perfectCount, s.goodCount, total);
    const snapshot: RunSummary = {
      score: Math.round(s.score),
      bestCombo: s.bestCombo,
      accuracy,
      songsCompleted: s.songsCompleted,
      victory,
    };

    audioEngine.stopAllNotes();
    s.heldSet.clear();
    setHeldNotes([]);
    setRunSummary(snapshot);
    setPhase('gameover');
    document.body.dataset.state = 'gameover';

    if (snapshot.score > bestLocalScore) {
      setBestLocalScore(snapshot.score);
      try {
        localStorage.setItem(LOCAL_BEST_KEY, String(snapshot.score));
      } catch {
        // Ignore storage error
      }
    }

    if (victory) {
      audioEngine.playSongFanfare();
      sceneRef.current?.triggerSongAura('#fde047');
    }

    // Attempt cloud save immediately if signed in
    if (user && snapshot.score > 0) {
      setCloudSaving(true);
      setCloudStatusMsg(null);
      void submitCloudScore({
        playerName: s.playerName,
        score: snapshot.score,
        bestCombo: snapshot.bestCombo,
        accuracy: snapshot.accuracy,
        songsCompleted: snapshot.songsCompleted,
      })
        .then((res) => {
          setCloudStatusMsg(
            res.isNewRecord
              ? 'Novo recorde pessoal salvo na nuvem!'
              : 'Pontuação sincronizada com o Placar Global.',
          );
        })
        .catch(() => {
          setCloudStatusMsg('Não foi possível salvar agora. Tente novamente.');
        })
        .finally(() => setCloudSaving(false));
    }
  }, [bestLocalScore, user]);

  const loadSongStage = useCallback((idx: number) => {
    const s = simRef.current;
    const song = OCARINA_SONGS[idx];
    const tempoScale = 0.88 + idx * 0.055; // Smooth difficulty ramp across 6 songs
    const nextSched = buildSongSchedule(song, 1.55, tempoScale);
    s.songIndex = idx;
    s.songTimeSec = 0;
    s.schedule = nextSched;
    setSongIndex(idx);
    setSchedule(nextSched);
  }, []);

  const startGame = useCallback(
    (targetMode: GameMode) => {
      audioEngine.unlock();
      audioEngine.stopAllNotes();
      inputRef.current?.clearAllHeld();

      const s = simRef.current;
      s.mode = targetMode;
      s.score = 0;
      s.combo = 0;
      s.bestCombo = 0;
      s.hearts = MAX_HALF_HEARTS;
      s.perfectCount = 0;
      s.goodCount = 0;
      s.missCount = 0;
      s.songsCompleted = 0;
      s.heldSet.clear();
      s.recentFreeNotes = [];

      setMode(targetMode);
      setScore(0);
      setCombo(0);
      setHearts(MAX_HALF_HEARTS);
      setHeldNotes([]);
      setRecentFreeNotes([]);
      setRecognizedSong(null);
      setLastFeedback(null);
      setRunSummary(null);
      setCloudStatusMsg(null);
      setScoreboardOpen(false);
      loadSongStage(0);

      sceneRef.current?.setComboLevel(0);
      document.body.dataset.state = 'playing';
      setPhase('playing');
    },
    [loadSongStage],
  );

  const handleNotePress = useCallback(
    (note: NoteId) => {
      audioEngine.unlock();
      const s = simRef.current;
      if (s.heldSet.has(note)) return;

      s.heldSet.add(note);
      setHeldNotes(Array.from(s.heldSet));
      sceneRef.current?.pressHoleVisual(note, true);
      audioEngine.startNote(note, s.semitoneShift);

      if (s.phase !== 'playing') return;

      if (s.mode === 'livre') {
        const nextHist = [...s.recentFreeNotes, note].slice(-12);
        s.recentFreeNotes = nextHist;
        setRecentFreeNotes(nextHist);
        const matched = matchSongSequence(nextHist);
        if (matched) {
          setRecognizedSong(matched);
          audioEngine.playSongFanfare();
          sceneRef.current?.triggerSongAura(matched.auraColor);
          s.recentFreeNotes = [];
        }
        return;
      }

      // Desafio Rhythm Mode: find closest pending matching note within timing window
      let bestItem: ScheduledBeatNote | null = null;
      let bestAbsDelta = Infinity;
      for (const item of s.schedule) {
        if (item.status !== 'pending' || item.note !== note) continue;
        const absDelta = Math.abs(item.targetTimeSec - s.songTimeSec);
        if (absDelta <= TIMING_WINDOW_GOOD && absDelta < bestAbsDelta) {
          bestAbsDelta = absDelta;
          bestItem = item;
        }
      }

      if (bestItem) {
        const grade = evaluateNoteHit(bestAbsDelta);
        bestItem.status = 'hit';
        bestItem.grade = grade;
        s.combo += 1;
        s.bestCombo = Math.max(s.bestCombo, s.combo);
        if (grade === 'perfeito') s.perfectCount += 1;
        else s.goodCount += 1;

        const pts = computeHitPoints(grade, s.combo);
        s.score += pts;
        s.feedbackCounter += 1;

        setScore(s.score);
        setCombo(s.combo);
        setLastFeedback({ grade, id: s.feedbackCounter });
        setSchedule([...s.schedule]);
        sceneRef.current?.setComboLevel(s.combo);
      } else {
        // Stray wrong note inside Desafio mode breaks combo
        s.combo = 0;
        s.missCount += 1;
        s.feedbackCounter += 1;
        setCombo(0);
        setLastFeedback({ grade: 'erro', id: s.feedbackCounter });
        sceneRef.current?.setComboLevel(0);
      }
    },
    [],
  );

  const handleNoteRelease = useCallback((note: NoteId) => {
    const s = simRef.current;
    if (!s.heldSet.has(note)) return;
    s.heldSet.delete(note);
    setHeldNotes(Array.from(s.heldSet));
    sceneRef.current?.pressHoleVisual(note, false);
    audioEngine.stopNote(note);
  }, []);

  const handleSemitoneChange = useCallback((shift: number) => {
    simRef.current.semitoneShift = shift;
    setSemitoneShift(shift);
    audioEngine.updateBend(shift, sceneRef.current?.getVibratoIntensity() ?? 0);
  }, []);

  const handlePauseToggle = useCallback(() => {
    const s = simRef.current;
    if (s.phase === 'playing') {
      audioEngine.stopAllNotes();
      inputRef.current?.clearAllHeld();
      setPhase('paused');
      document.body.dataset.state = 'paused';
    } else if (s.phase === 'paused') {
      setPhase('playing');
      document.body.dataset.state = 'playing';
    }
  }, []);

  const handleMuteToggle = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      audioEngine.setMuted(next);
      return next;
    });
  }, []);

  // Mount Three.js Scene & Input Manager ONCE
  useEffect(() => {
    if (!canvasMountRef.current) return;

    const scene = new OcarinaSceneController({
      onHolePress: (n) => handleNotePress(n),
      onHoleRelease: (n) => handleNoteRelease(n),
      onDragTilt: () => {
        audioEngine.updateBend(
          simRef.current.semitoneShift,
          sceneRef.current?.getVibratoIntensity() ?? 0,
        );
      },
    });
    scene.mount(canvasMountRef.current);
    sceneRef.current = scene;

    const input = new UnifiedInputManager({
      onNotePress: (n) => handleNotePress(n),
      onNoteRelease: (n) => handleNoteRelease(n),
      onSemitoneChange: (shift) => handleSemitoneChange(shift),
      onAnalogTilt: (tx, ty) => {
        sceneRef.current?.setPointerTilt(tx, ty);
        audioEngine.updateBend(
          simRef.current.semitoneShift,
          sceneRef.current?.getVibratoIntensity() ?? 0,
        );
      },
      onStartOrConfirm: () => {
        if (simRef.current.phase === 'title') {
          startGame('desafio');
        }
      },
      onPauseToggle: () => handlePauseToggle(),
      onMuteToggle: () => handleMuteToggle(),
      onRestart: () => {
        if (simRef.current.phase !== 'title') {
          startGame(simRef.current.mode);
        }
      },
      onScoreboardToggle: () => setScoreboardOpen((o) => !o),
      onGamepadStatus: (connected, name) => setGamepadName(connected ? name : null),
    });
    inputRef.current = input;

    // Support ?autostart=1 for instant gameplay testing
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      startGame('desafio');
    }

    return () => {
      input.dispose();
      scene.dispose();
      audioEngine.stopAllNotes();
    };
  }, [handleMuteToggle, handleNotePress, handleNoteRelease, handlePauseToggle, handleSemitoneChange, startGame]);

  // 60Hz Rhythm Chart Simulation Loop (Zero React setState unless discrete miss/song clear occurs)
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const stepRhythm = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      const s = simRef.current;
      if (s.phase === 'playing' && s.mode === 'desafio' && !s.scoreboardOpen) {
        s.songTimeSec += dt;

        // Smoothly translate musical staff track DOM node without React re-renders
        if (staffTrackRef.current) {
          const offsetPx = HIT_CURSOR_X - s.songTimeSec * PIXELS_PER_SEC;
          staffTrackRef.current.style.transform = `translate3d(${offsetPx.toFixed(1)}px, 0, 0)`;
        }

        // Check missed notes past timing window
        let missedAny = false;
        let allResolved = true;
        for (const item of s.schedule) {
          if (item.status === 'pending') {
            if (s.songTimeSec > item.targetTimeSec + TIMING_WINDOW_GOOD) {
              item.status = 'missed';
              missedAny = true;
              s.missCount += 1;
              s.combo = 0;
              s.hearts = Math.max(0, s.hearts - 1);
            } else {
              allResolved = false;
            }
          }
        }

        if (missedAny) {
          audioEngine.playMissSfx();
          s.feedbackCounter += 1;
          setCombo(0);
          setHearts(s.hearts);
          setLastFeedback({ grade: 'erro', id: s.feedbackCounter });
          setSchedule([...s.schedule]);
          sceneRef.current?.setComboLevel(0);

          if (s.hearts <= 0) {
            finishRun(false);
          }
        } else if (allResolved && s.schedule.length > 0) {
          const lastNoteEnd = s.schedule[s.schedule.length - 1].targetTimeSec + 0.55;
          if (s.songTimeSec >= lastNoteEnd) {
            // Song Completed!
            const currentSong = OCARINA_SONGS[s.songIndex];
            s.songsCompleted += 1;
            s.score += 500;
            s.hearts = Math.min(MAX_HALF_HEARTS, s.hearts + 2);
            setScore(s.score);
            setHearts(s.hearts);
            audioEngine.playSongFanfare();
            sceneRef.current?.triggerSongAura(currentSong.auraColor);

            if (s.songIndex + 1 >= OCARINA_SONGS.length) {
              finishRun(true);
            } else {
              loadSongStage(s.songIndex + 1);
            }
          }
        }
      }

      rafId = requestAnimationFrame(stepRhythm);
    };

    rafId = requestAnimationFrame(stepRhythm);
    return () => cancelAnimationFrame(rafId);
  }, [finishRun, loadSongStage]);

  // Firebase Auth & Cloud Leaderboard Subscription
  useEffect(() => {
    const unsubAuth = subscribeAuthUser((u) => {
      setUser(u);
      if (u?.displayName && !localStorage.getItem(LOCAL_NAME_KEY)) {
        setPlayerName(u.displayName.slice(0, 24));
      }
    });

    const unsubBoard = subscribeGlobalLeaderboard(
      (entries) => {
        setLeaderboard(entries);
        setLeaderboardLoading(false);
        sceneRef.current?.updateLeaderboardTexture(entries);
      },
      () => {
        setLeaderboardLoading(false);
      },
    );

    return () => {
      unsubAuth();
      unsubBoard();
    };
  }, []);

  const handleSignInAndSave = async () => {
    try {
      const signedUser = await signInWithGoogle();
      setUser(signedUser);
      const nameToUse = playerName.trim().length >= 2 ? playerName.trim() : signedUser.displayName || 'Viajante';
      if (runSummary && runSummary.score > 0) {
        setCloudSaving(true);
        const res = await submitCloudScore({
          playerName: nameToUse,
          score: runSummary.score,
          bestCombo: runSummary.bestCombo,
          accuracy: runSummary.accuracy,
          songsCompleted: runSummary.songsCompleted,
        });
        setCloudStatusMsg(
          res.isNewRecord
            ? 'Novo recorde salvo no Placar Global!'
            : 'Pontuação sincronizada na nuvem.',
        );
      }
    } catch (err) {
      console.error('Sign-in or save failed:', err);
      setCloudStatusMsg('Falha ao conectar com o Google.');
    } finally {
      setCloudSaving(false);
    }
  };

  const cloudTopScore = leaderboard.length > 0 ? leaderboard[0].score : null;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0b1622]">
      {/* Isolated WebGL Mount Container (Never re-renders on React HUD updates) */}
      <div ref={canvasMountRef} className="fixed inset-0 z-0" />

      {phase === 'title' && !scoreboardOpen && (
        <TitleOverlay
          onStart={(m) => startGame(m)}
          onOpenScoreboard={() => setScoreboardOpen((o) => !o)}
          bestLocalScore={bestLocalScore}
          cloudTopScore={cloudTopScore}
        />
      )}

      {phase !== 'title' && (
        <HudOverlay
          mode={mode}
          score={score}
          combo={combo}
          hearts={hearts}
          maxHearts={MAX_HALF_HEARTS}
          activeSong={OCARINA_SONGS[songIndex]}
          songIndex={songIndex}
          totalSongs={OCARINA_SONGS.length}
          heldNotes={heldNotes}
          semitoneShift={semitoneShift}
          lastFeedback={lastFeedback}
          recognizedSong={recognizedSong}
          recentFreeNotes={recentFreeNotes}
          muted={muted}
          scoreboardOpen={scoreboardOpen}
          gamepadName={gamepadName}
          schedule={schedule}
          staffTrackRef={staffTrackRef}
          onSwitchMode={(m) => startGame(m)}
          onToggleScoreboard={() => setScoreboardOpen((o) => !o)}
          onToggleMute={handleMuteToggle}
          onPause={handlePauseToggle}
          onPadPress={handleNotePress}
          onPadRelease={handleNoteRelease}
        />
      )}

      {!scoreboardOpen && (
        <StatusModal
          phase={phase}
          summary={runSummary}
          bestLocalScore={bestLocalScore}
          user={user}
          cloudSaving={cloudSaving}
          cloudStatusMsg={cloudStatusMsg}
          onResume={handlePauseToggle}
          onRestart={() => startGame(mode)}
          onReturnTitle={() => {
            audioEngine.stopAllNotes();
            setScoreboardOpen(false);
            setPhase('title');
            document.body.dataset.state = 'title';
          }}
          onOpenScoreboard={() => setScoreboardOpen(true)}
          onSignInAndSave={() => void handleSignInAndSave()}
        />
      )}

      <LeaderboardDrawer
        open={scoreboardOpen}
        entries={leaderboard}
        loading={leaderboardLoading}
        user={user}
        playerName={playerName}
        onChangePlayerName={setPlayerName}
        onSaveNickname={async (n) => {
          await updatePlayerNickname(n);
        }}
        onSignIn={async () => {
          await handleSignInAndSave();
        }}
        onSignOut={async () => {
          await signOutUser();
        }}
        onClose={() => setScoreboardOpen(false)}
      />
    </main>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <OcarinaGame />
    </ErrorBoundary>
  );
}
