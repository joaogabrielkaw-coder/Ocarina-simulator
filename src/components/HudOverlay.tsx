import React, { useRef, useState } from 'react';
import {
  GameMode,
  getMidiNoteName,
  getMusicalNoteName,
  GRID_15_NOTES,
  GridNoteSpec,
  HitGrade,
  NoteId,
  OCARINA_NOTES,
  OCARINA_SONGS,
  OcarinaSong,
  ScheduledBeatNote,
} from '../game/musicData';

interface HudOverlayProps {
  mode: GameMode;
  score: number;
  combo: number;
  hearts: number;
  maxHearts: number;
  activeSong: OcarinaSong;
  songIndex: number;
  totalSongs: number;
  heldNotes: NoteId[];
  heldGridIds: string[];
  lastGridSpec: GridNoteSpec | null;
  semitoneShift: number;
  vibratoActive: boolean;
  lastFeedback: { grade: HitGrade; id: number } | null;
  recognizedSong: OcarinaSong | null;
  recentFreeNotes: NoteId[];
  activeDemoSongId: string | null;
  selectedPracticeSong: OcarinaSong | null;
  practiceStepIdx: number;
  muted: boolean;
  crtEnabled: boolean;
  scoreboardOpen: boolean;
  gamepadName: string | null;
  schedule: ScheduledBeatNote[];
  staffTrackRef: React.RefObject<HTMLDivElement | null>;
  onSwitchMode: (m: GameMode) => void;
  onToggleScoreboard: () => void;
  onToggleMute: () => void;
  onToggleCrt: () => void;
  onPause: () => void;
  onGridPress: (spec: GridNoteSpec) => void;
  onGridRelease: (spec: GridNoteSpec) => void;
  onSemitoneChange: (shift: number) => void;
  onVibratoToggle: (active: boolean) => void;
  onSelectPracticeSong: (song: OcarinaSong | null) => void;
  onPlayDemo: (song: OcarinaSong) => void;
  onStopDemo: () => void;
}

const PITCH_MODIFIERS: Array<{ shift: number; label: string; keyHint: string }> = [
  { shift: -2, label: '-2 Tom', keyHint: '[' },
  { shift: -1, label: '-1♭', keyHint: 'Alt' },
  { shift: 1, label: '+1♯', keyHint: 'Shift' },
  { shift: 2, label: '+2 Tom', keyHint: ']' },
];

const HeartSocket: React.FC<{ state: 'full' | 'half' | 'empty' }> = ({ state }) => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 drop-shadow-[0_2px_2px_rgba(0,0,0,0.85)] sm:h-4 sm:w-4" aria-hidden="true">
    <path
      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      fill={state === 'empty' ? '#132234' : '#dc2626'}
      stroke="#08111c"
      strokeWidth="2"
    />
    {state === 'half' && (
      <path
        d="M12 5.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35V5.09z"
        fill="#132234"
      />
    )}
    {state !== 'empty' && (
      <path d="M7.5 5.2c-1.4 0-2.5 1-2.8 2.3" stroke="#fca5a5" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    )}
  </svg>
);

const LeafClusterSvg: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 44 36" className={className} aria-hidden="true">
    <path d="M18 32 C8 28, 3 17, 6 6 C17 7, 25 16, 22 30 Z" fill="#46a31d" stroke="#0b2406" strokeWidth="2.2" />
    <path d="M10 12 L19 26" stroke="#8ce842" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M22 30 C22 18, 29 9, 40 8 C40 19, 34 28, 22 31 Z" fill="#5cc227" stroke="#0b2406" strokeWidth="2.2" />
    <path d="M24 27 L35 13" stroke="#9cf257" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M6 26 C12 22, 18 23, 21 31 C14 34, 8 32, 6 26 Z" fill="#2e7d12" stroke="#0b2406" strokeWidth="2" />
  </svg>
);

const PurpleFlowerSvg: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
    <circle cx="18" cy="8" r="6" fill="#a855f7" stroke="#1e0836" strokeWidth="2" />
    <circle cx="27" cy="15" r="6" fill="#9333ea" stroke="#1e0836" strokeWidth="2" />
    <circle cx="24" cy="26" r="6" fill="#a855f7" stroke="#1e0836" strokeWidth="2" />
    <circle cx="12" cy="26" r="6" fill="#9333ea" stroke="#1e0836" strokeWidth="2" />
    <circle cx="9" cy="15" r="6" fill="#a855f7" stroke="#1e0836" strokeWidth="2" />
    <circle cx="18" cy="18" r="4.5" fill="#fde047" stroke="#1e0836" strokeWidth="1.8" />
  </svg>
);

export const HudOverlay: React.FC<HudOverlayProps> = ({
  mode,
  score,
  combo,
  hearts,
  maxHearts,
  activeSong,
  songIndex,
  totalSongs,
  heldNotes,
  heldGridIds,
  lastGridSpec,
  semitoneShift,
  vibratoActive,
  lastFeedback,
  recognizedSong,
  recentFreeNotes,
  activeDemoSongId,
  selectedPracticeSong,
  practiceStepIdx,
  muted,
  crtEnabled,
  scoreboardOpen,
  gamepadName,
  schedule,
  staffTrackRef,
  onSwitchMode,
  onToggleScoreboard,
  onToggleMute,
  onToggleCrt,
  onPause,
  onGridPress,
  onGridRelease,
  onSemitoneChange,
  onVibratoToggle,
  onSelectPracticeSong,
  onPlayDemo,
  onStopDemo,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [songbookOpen, setSongbookOpen] = useState(false);
  const [songCategory, setSongCategory] = useState<'principal' | 'templo'>('principal');
  const activePointerSpecsRef = useRef<Map<number, GridNoteSpec>>(new Map());

  if (scoreboardOpen) return null;

  const heartSlots = [];
  const totalSlots = Math.floor(maxHearts / 2);
  for (let i = 0; i < totalSlots; i++) {
    const val = hearts - i * 2;
    const state = val >= 2 ? 'full' : val === 1 ? 'half' : 'empty';
    heartSlots.push(<HeartSocket key={i} state={state} />);
  }

  const lastHeldZelda = heldNotes.length > 0 ? heldNotes[heldNotes.length - 1] : null;
  const livePitchLabel = lastGridSpec
    ? getMidiNoteName(lastGridSpec.midiNote, semitoneShift)
    : lastHeldZelda
      ? getMusicalNoteName(lastHeldZelda, semitoneShift)
      : '---';
  const visibleSongs = OCARINA_SONGS.filter((s) => s.category === songCategory);

  const zeldaHintToNoteId: Record<string, NoteId> = {
    A: 'A',
    '▼': 'DOWN',
    '▶': 'RIGHT',
    '◀': 'LEFT',
    '▲': 'UP',
  };

  const releasePointerSpec = (pointerId: number, target?: HTMLElement) => {
    const heldSpec = activePointerSpecsRef.current.get(pointerId);
    if (heldSpec) {
      activePointerSpecsRef.current.delete(pointerId);
      let stillHeldByOther = false;
      for (const s of activePointerSpecsRef.current.values()) {
        if (s.id === heldSpec.id) {
          stillHeldByOther = true;
          break;
        }
      }
      if (!stillHeldByOther) {
        onGridRelease(heldSpec);
      }
    }
    try {
      target?.releasePointerCapture?.(pointerId);
    } catch {
      // Ignore if pointer capture is inactive
    }
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between px-[max(0.625rem,env(safe-area-inset-left))] pr-[max(0.625rem,env(safe-area-inset-right))] pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-4">
      {/* Top Bar: Reference Top-Left Circular Menu + Optional Compact Desafio/Songbook Controls */}
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        {/* Top-Left Circular Gold-Rimmed Menu Button (Exact Reference Style) */}
        <div className="pointer-events-auto relative flex items-start gap-2.5">
          <button
            type="button"
            tabIndex={-1}
            data-testid="hud-menu-btn"
            aria-label="Abrir Menu da Ocarina"
            onClick={(e) => {
              e.currentTarget.blur();
              setMenuOpen((o) => !o);
            }}
            className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-[3px] border-[#f2b84b] bg-[#0e1233] shadow-[0_0_0_2px_#1e1307,0_6px_14px_rgba(0,0,0,0.7)] transition-transform hover:scale-105 active:scale-95 sm:h-12 sm:w-12"
          >
            <span className="flex flex-col gap-1 sm:gap-1.5">
              <span className="block h-[2.5px] w-4 rounded-full bg-[#f5c45e] sm:h-[3px] sm:w-5" />
              <span className="block h-[2.5px] w-4 rounded-full bg-[#f5c45e] sm:h-[3px] sm:w-5" />
              <span className="block h-[2.5px] w-4 rounded-full bg-[#f5c45e] sm:h-[3px] sm:w-5" />
            </span>
            <LeafClusterSvg className="pointer-events-none absolute -top-2 -right-2 h-4 w-4 rotate-12 sm:h-5 sm:w-5" />
            <PurpleFlowerSvg className="pointer-events-none absolute -right-2 -bottom-2 h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {/* Compact Menu Popover */}
          {menuOpen && (
            <div
              data-testid="hud-menu-drawer"
              className="hyrule-scroll mt-1 flex max-h-[70dvh] w-60 flex-col gap-1.5 overflow-y-auto border-2 border-[#d4af37]/75 bg-[#090f24]/95 p-2.5 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-700/70 pb-1.5">
                <span className="font-display text-xs font-bold tracking-wider text-[#fde68a]">
                  MENU DA OCARINA
                </span>
                <span
                  data-testid="live-pitch-readout"
                  className="border border-slate-700 bg-[#050919] px-1.5 py-0.5 font-mono-num text-[11px] font-bold text-[#5eead4]"
                >
                  {livePitchLabel}
                </span>
              </div>

              <button
                type="button"
                tabIndex={-1}
                data-testid="mode-switch-btn"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setMenuOpen(false);
                  onSwitchMode(mode === 'desafio' ? 'livre' : 'desafio');
                }}
                className="cursor-pointer border border-[#5eead4]/55 bg-[#10263b] px-2.5 py-1.5 text-left text-xs font-bold text-[#d9f9f5] hover:border-[#5eead4]"
              >
                {mode === 'desafio' ? 'Alternar para Modo Livre' : 'Alternar para Desafio Musical'}
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setMenuOpen(false);
                  setSongbookOpen((v) => !v);
                }}
                className="cursor-pointer border border-[#d4af37]/50 bg-[#1a1829] px-2.5 py-1.5 text-left text-xs font-bold text-[#fde68a] hover:border-[#fde68a]"
              >
                {songbookOpen ? 'Fechar Caderno (12 Músicas)' : 'Abrir Caderno (12 Músicas)'}
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setMenuOpen(false);
                  onToggleScoreboard();
                }}
                className="cursor-pointer border border-slate-600/80 bg-[#0f1730] px-2.5 py-1.5 text-left text-xs font-semibold text-slate-200 hover:border-[#fde68a]"
              >
                Placar Global 3D [Tab]
              </button>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleMute();
                  }}
                  className="flex-1 cursor-pointer border border-slate-600/80 bg-[#0f1730] px-2 py-1.5 text-xs font-semibold text-slate-200 hover:border-[#5eead4]"
                >
                  {muted ? 'Ativar Som' : 'Silenciar [M]'}
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setMenuOpen(false);
                    onPause();
                  }}
                  className="flex-1 cursor-pointer border border-slate-600/80 bg-[#0f1730] px-2 py-1.5 text-xs font-semibold text-slate-200 hover:border-[#fde68a]"
                >
                  Pausar [Esc]
                </button>
              </div>

              <button
                type="button"
                tabIndex={-1}
                data-testid="toggle-crt-btn"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleCrt();
                }}
                className={`cursor-pointer border px-2.5 py-1.5 text-left text-xs font-semibold ${
                  crtEnabled
                    ? 'border-[#5eead4]/60 bg-[#0f2438] text-[#5eead4]'
                    : 'border-slate-700 bg-[#0f1730] text-slate-300'
                }`}
              >
                TV Antiga (CRT): {crtEnabled ? 'Ligada' : 'Desligada'}
              </button>

              {/* Pitch Modifiers inside Menu */}
              <div className="border-t border-slate-700/70 pt-1.5">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Modificadores de Tom
                </div>
                <div className="flex flex-wrap gap-1">
                  {PITCH_MODIFIERS.map((mod) => {
                    const active = semitoneShift === mod.shift;
                    return (
                      <button
                        key={mod.shift}
                        type="button"
                        tabIndex={-1}
                        data-testid={`mod-shift-${mod.shift}`}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          onSemitoneChange(active ? 0 : mod.shift);
                        }}
                        className={`cursor-pointer border px-1.5 py-0.5 text-[10px] font-bold ${
                          active
                            ? 'border-[#5eead4] bg-[#143a4f] text-[#5eead4]'
                            : 'border-slate-700 bg-[#0b1328] text-slate-300'
                        }`}
                      >
                        {mod.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    tabIndex={-1}
                    data-testid="mod-vibrato"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onVibratoToggle(!vibratoActive);
                    }}
                    className={`cursor-pointer border px-1.5 py-0.5 text-[10px] font-bold ${
                      vibratoActive
                        ? 'border-[#fde68a] bg-[#362b0e] text-[#fde68a]'
                        : 'border-slate-700 bg-[#0b1328] text-slate-300'
                    }`}
                  >
                    Vibrato
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Top-Center: Slim Rhythm Staff Bar ONLY in Desafio mode (never blocks Musician/Cat below) */}
        {mode === 'desafio' && (
          <div className="flex min-w-0 max-w-md flex-1 flex-col items-center gap-1">
            <div className="landscape-staff-bar relative h-11 w-full overflow-hidden border border-[#d4af37]/50 bg-[#070d20]/85 shadow-lg sm:h-14">
              {[0, 1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className="absolute right-0 left-0 h-px bg-slate-500/45"
                  style={{ top: `${78 - step * 15}%` }}
                />
              ))}
              <div className="absolute top-1 bottom-1 left-[76px] w-1 bg-[#fde68a]" />
              {[0, 1, 2, 3, 4].map((step) => (
                <div
                  key={`ring-${step}`}
                  className="absolute left-[76px] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#fde68a]/55"
                  style={{ top: `${78 - step * 15}%` }}
                />
              ))}
              <div ref={staffTrackRef} className="absolute inset-0 will-change-transform">
                {schedule.map((item) => {
                  const spec = OCARINA_NOTES[item.note];
                  const topPct = 78 - spec.staffStep * 15;
                  return (
                    <div
                      key={item.uid}
                      data-note-uid={item.uid}
                      style={{
                        top: `${topPct}%`,
                        left: `${item.targetTimeSec * 220}px`,
                        backgroundColor:
                          item.status === 'hit'
                            ? '#34d399'
                            : item.status === 'missed'
                              ? '#64748b'
                              : spec.colorHex,
                        opacity: item.status === 'pending' ? 1 : 0.35,
                      }}
                      className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#08111c] text-[10px] font-black text-[#08111c]"
                    >
                      {spec.symbol}
                    </div>
                  );
                })}
              </div>
            </div>

            {lastFeedback && (
              <div
                key={lastFeedback.id}
                data-testid="hit-feedback"
                className={`font-display text-sm font-extrabold tracking-widest hud-text-stroke ${
                  lastFeedback.grade === 'perfeito'
                    ? 'text-[#fde68a]'
                    : lastFeedback.grade === 'bom'
                      ? 'text-[#5eead4]'
                      : 'text-rose-400'
                }`}
              >
                {lastFeedback.grade === 'perfeito'
                  ? 'PERFEITO!'
                  : lastFeedback.grade === 'bom'
                    ? 'BOM!'
                    : 'ERRO'}
              </div>
            )}
          </div>
        )}

        {/* Top-Right: Compact Score/Hearts in Desafio OR Recognized Song/Status */}
        <div className="pointer-events-auto flex shrink-0 flex-col items-end gap-1 sm:gap-1.5">
          {mode === 'desafio' ? (
            <div className="flex flex-col items-end gap-0.5 sm:gap-1">
              <div className="flex items-center gap-0.5 sm:gap-1" aria-label={`Vitalidade ${hearts} de ${maxHearts}`}>
                {heartSlots}
              </div>
              <div className="flex items-baseline gap-2 sm:gap-3">
                <div className="text-right">
                  <div className="text-[8px] font-bold tracking-[0.16em] text-slate-300 hud-text-stroke sm:text-[9px] sm:tracking-[0.18em]">
                    PONTOS
                  </div>
                  <div
                    data-testid="hud-score"
                    className="font-mono-num text-lg font-extrabold leading-none text-[#fde68a] hud-text-stroke sm:text-2xl"
                  >
                    {Math.round(score)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[8px] font-bold tracking-[0.16em] text-slate-300 hud-text-stroke sm:text-[9px] sm:tracking-[0.18em]">
                    COMBO
                  </div>
                  <div
                    data-testid="hud-combo"
                    className="font-mono-num text-base font-bold leading-none text-[#5eead4] hud-text-stroke sm:text-xl"
                  >
                    x{Math.round(combo)}
                  </div>
                </div>
              </div>
              <div className="max-w-[108px] truncate text-[10px] font-semibold text-slate-200 hud-text-stroke sm:max-w-none sm:text-[11px]">
                <span className="text-[#fde68a]">
                  {songIndex + 1}/{totalSongs}
                </span>{' '}
                · {activeSong.title}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1">
              {recognizedSong && (
                <div
                  data-testid="recognized-song-banner"
                  className="border border-[#fde68a]/80 bg-[#0b132b]/95 px-2.5 py-1 text-xs font-bold text-[#fde68a] shadow-lg"
                >
                  ♪ {recognizedSong.title}
                </div>
              )}
              {selectedPracticeSong && (
                <div className="flex items-center gap-2 border border-[#5eead4]/55 bg-[#091124]/92 px-2.5 py-1">
                  <span className="text-[11px] font-bold text-[#fde68a]">
                    {selectedPracticeSong.title}
                  </span>
                  <div className="flex items-center gap-1">
                    {selectedPracticeSong.sequence.map((nid, idx) => {
                      const spec = OCARINA_NOTES[nid];
                      const done = idx < practiceStepIdx;
                      const current = idx === practiceStepIdx;
                      return (
                        <span
                          key={`${nid}-${idx}`}
                          style={{
                            borderColor: current ? '#ffffff' : spec.colorHex,
                            backgroundColor: done ? '#059669' : current ? spec.colorHex : '#102033',
                            color: done || current ? '#08111c' : '#e2e8f0',
                          }}
                          className="flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-black"
                        >
                          {spec.symbol}
                        </span>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    tabIndex={-1}
                    data-testid="demo-play-btn"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      if (activeDemoSongId === selectedPracticeSong.id) onStopDemo();
                      else onPlayDemo(selectedPracticeSong);
                    }}
                    className="cursor-pointer border border-[#5eead4]/70 bg-[#102b3d] px-2 py-0.5 text-[10px] font-bold text-[#5eead4]"
                  >
                    {activeDemoSongId === selectedPracticeSong.id ? 'Parar' : '▶ Ouvir Link'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Active modifiers / Gamepad compact badges */}
          {(semitoneShift !== 0 || vibratoActive || gamepadName) && (
            <div className="flex flex-wrap justify-end gap-1 text-[10px] font-bold">
              {semitoneShift !== 0 && (
                <span className="border border-[#5eead4]/55 bg-[#0a1226]/90 px-1.5 py-0.5 text-[#5eead4]">
                  {semitoneShift > 0 ? `+${semitoneShift}` : semitoneShift} Tom
                </span>
              )}
              {vibratoActive && (
                <span className="border border-[#fde68a]/55 bg-[#0a1226]/90 px-1.5 py-0.5 text-[#fde68a]">
                  Vibrato
                </span>
              )}
              {gamepadName && (
                <span className="border border-emerald-400/50 bg-[#0a1226]/90 px-1.5 py-0.5 text-emerald-300">
                  Controle: {gamepadName}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Collapsible 12-Song Zelda Caderno Drawer (docks cleanly at bottom-right away from characters) */}
      {songbookOpen && (
        <div
          data-testid="songbook-panel"
          className="hyrule-scroll pointer-events-auto fixed inset-x-3 bottom-[198px] z-25 max-h-[38dvh] overflow-y-auto border-2 border-[#d4af37]/65 bg-[#090f24]/95 p-3 shadow-2xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-h-none sm:w-96"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-display text-xs font-bold tracking-wider text-[#fde68a]">
              CADERNO DE MELODIAS (12)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                tabIndex={-1}
                data-testid="cat-principal"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setSongCategory('principal');
                }}
                className={`cursor-pointer border px-1.5 py-0.5 text-[10px] font-bold ${
                  songCategory === 'principal'
                    ? 'border-[#fde68a] bg-[#2a2310] text-[#fde68a]'
                    : 'border-slate-700 bg-[#0d1630] text-slate-400'
                }`}
              >
                Principais
              </button>
              <button
                type="button"
                tabIndex={-1}
                data-testid="cat-templo"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setSongCategory('templo');
                }}
                className={`cursor-pointer border px-1.5 py-0.5 text-[10px] font-bold ${
                  songCategory === 'templo'
                    ? 'border-[#5eead4] bg-[#0f2b3a] text-[#5eead4]'
                    : 'border-slate-700 bg-[#0d1630] text-slate-400'
                }`}
              >
                Templos
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setSongbookOpen(false)}
                className="cursor-pointer px-1.5 text-xs font-bold text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1">
            {visibleSongs.map((song) => {
              const isSelected = selectedPracticeSong?.id === song.id;
              return (
                <button
                  key={song.id}
                  type="button"
                  tabIndex={-1}
                  data-testid={`song-chip-${song.id}`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSelectPracticeSong(isSelected ? null : song);
                  }}
                  className={`flex cursor-pointer items-center justify-between gap-1 border px-2 py-1 text-left text-[11px] ${
                    isSelected
                      ? 'border-[#fde68a] bg-[#1e2e4e] text-white'
                      : 'border-slate-700/80 bg-[#0d1630] text-slate-200 hover:border-slate-500'
                  }`}
                >
                  <span className="truncate font-semibold text-[#fde68a]">
                    {song.title.replace('Canção ', '').replace('do ', '').replace('da ', '').replace('de ', '')}
                  </span>
                  <span className="shrink-0 font-mono-num text-[10px] text-[#5eead4]">
                    {song.sequence.map((n) => OCARINA_NOTES[n].symbol).join('')}
                  </span>
                </button>
              );
            })}
          </div>

          {recentFreeNotes.length > 0 && (
            <div className="mt-2 flex items-center gap-1 border-t border-slate-700/70 pt-1.5">
              <span className="text-[10px] text-slate-400">Notas:</span>
              {recentFreeNotes.slice(-8).map((nid, idx) => (
                <span
                  key={`${nid}-${idx}`}
                  style={{ backgroundColor: OCARINA_NOTES[nid].colorHex }}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-[#08111c]"
                >
                  {OCARINA_NOTES[nid].symbol}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom-Left (Desktop/Landscape) / Bottom-Center Full-Width Ergonomic (Android Portrait): 3x5 Royal Cobalt-Blue Keypad */}
      <div className="flex items-end justify-center sm:justify-start">
        <div className="landscape-keypad-wrap pointer-events-auto relative w-full max-w-[356px] border-2 border-[#261404] p-1.5 wood-pixel-frame sm:w-auto sm:max-w-none sm:p-2">
          {/* Botanical Corner Ornaments matching the Reference Screenshot */}
          <LeafClusterSvg className="pointer-events-none absolute -top-3 -left-3 z-10 h-6 w-7 -rotate-12 drop-shadow-[0_2px_2px_rgba(0,0,0,0.85)] sm:-top-4 sm:-left-4 sm:h-8 sm:w-9" />
          <LeafClusterSvg className="pointer-events-none absolute -top-3 -right-3 z-10 h-6 w-7 scale-x-[-1] rotate-12 drop-shadow-[0_2px_2px_rgba(0,0,0,0.85)] sm:-top-4 sm:-right-4 sm:h-8 sm:w-9" />
          <LeafClusterSvg className="pointer-events-none absolute -right-3 -bottom-3 z-10 h-6 w-7 rotate-[150deg] drop-shadow-[0_2px_2px_rgba(0,0,0,0.85)] sm:-right-4 sm:-bottom-4 sm:h-8 sm:w-9" />
          <div className="pointer-events-none absolute -bottom-2.5 -left-2.5 z-10 flex items-center sm:-bottom-3 sm:-left-3">
            <LeafClusterSvg className="h-6 w-7 -rotate-45 drop-shadow-[0_2px_2px_rgba(0,0,0,0.85)] sm:h-7 sm:w-8" />
            <PurpleFlowerSvg className="-ml-4 mt-1 h-6 w-6 drop-shadow-[0_2px_2px_rgba(0,0,0,0.85)] sm:-ml-5 sm:h-7 sm:w-7" />
          </div>

          <div
            data-testid="ocarina-keypad-3x5"
            className="grid grid-cols-5 gap-1 bg-[#04081c] p-1"
          >
            {GRID_15_NOTES.map((spec) => {
              const mappedHeld = spec.zeldaHint
                ? heldNotes.includes(zeldaHintToNoteId[spec.zeldaHint])
                : false;
              const isHeld = heldGridIds.includes(spec.id) || mappedHeld;
              return (
                <button
                  key={spec.id}
                  type="button"
                  tabIndex={-1}
                  data-testid={`grid-note-${spec.id}`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.blur();
                    try {
                      e.currentTarget.setPointerCapture?.(e.pointerId);
                    } catch {
                      // Ignore unsupported pointer capture
                    }
                    activePointerSpecsRef.current.set(e.pointerId, spec);
                    if (e.pointerType === 'touch') {
                      try {
                        navigator.vibrate?.(8);
                      } catch {
                        // Ignore vibration restrictions
                      }
                    }
                    onGridPress(spec);
                  }}
                  onPointerUp={(e) => releasePointerSpec(e.pointerId, e.currentTarget)}
                  onPointerCancel={(e) => releasePointerSpec(e.pointerId, e.currentTarget)}
                  onPointerLeave={(e) => {
                    if (!e.currentTarget.hasPointerCapture?.(e.pointerId) && heldGridIds.includes(spec.id)) {
                      onGridRelease(spec);
                    }
                  }}
                  className={`landscape-key-btn relative flex h-[48px] w-full cursor-pointer touch-none select-none items-center justify-center border transition-all sm:h-[70px] sm:w-[92px] ${
                    isHeld
                      ? 'translate-y-[1px] border-[#fde68a] bg-gradient-to-b from-[#2563eb] via-[#1d4ed8] to-[#1e3a8a] ring-1 ring-[#5eead4] shadow-[inset_0_2px_6px_rgba(255,255,255,0.4)]'
                      : 'border-[#254dc7] bg-gradient-to-b from-[#1739a3] via-[#0e2677] to-[#081956] shadow-[inset_0_1px_0_rgba(147,197,253,0.4),0_2px_0_#03081f] hover:from-[#1d44bd] hover:to-[#0c236e]'
                  }`}
                >
                  {spec.zeldaHint && (
                    <span className="absolute top-0.5 left-1 text-[8px] font-bold text-[#fde68a]/65 sm:text-[9px]">
                      {spec.zeldaHint}
                    </span>
                  )}
                  <span className="landscape-key-label font-sans text-[15px] font-black tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] sm:text-xl">
                    {spec.label}
                  </span>
                  <span className="absolute right-1 bottom-0.5 font-mono-num text-[8px] font-semibold text-blue-100/70 sm:right-1.5 sm:bottom-1 sm:text-[11px] sm:text-blue-100/85">
                    {spec.keyLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
