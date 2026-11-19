import React from 'react';
import {
  GameMode,
  HitGrade,
  NOTE_ORDER,
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
  hearts: number; // 0..10 half-hearts (5 full hearts)
  maxHearts: number;
  activeSong: OcarinaSong;
  songIndex: number;
  totalSongs: number;
  heldNotes: NoteId[];
  semitoneShift: number;
  lastFeedback: { grade: HitGrade; id: number } | null;
  recognizedSong: OcarinaSong | null;
  recentFreeNotes: NoteId[];
  muted: boolean;
  scoreboardOpen: boolean;
  gamepadName: string | null;
  schedule: ScheduledBeatNote[];
  staffTrackRef: React.RefObject<HTMLDivElement | null>;
  onSwitchMode: (m: GameMode) => void;
  onToggleScoreboard: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onPadPress: (note: NoteId) => void;
  onPadRelease: (note: NoteId) => void;
}

const HeartSocket: React.FC<{ state: 'full' | 'half' | 'empty' }> = ({ state }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" aria-hidden="true">
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
  semitoneShift,
  lastFeedback,
  recognizedSong,
  recentFreeNotes,
  muted,
  scoreboardOpen,
  gamepadName,
  schedule,
  staffTrackRef,
  onSwitchMode,
  onToggleScoreboard,
  onToggleMute,
  onPause,
  onPadPress,
  onPadRelease,
}) => {
  if (scoreboardOpen) return null;

  const heartSlots = [];
  const totalSlots = Math.floor(maxHearts / 2);
  for (let i = 0; i < totalSlots; i++) {
    const val = hearts - i * 2;
    const state = val >= 2 ? 'full' : val === 1 ? 'half' : 'empty';
    heartSlots.push(<HeartSocket key={i} state={state} />);
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5">
      {/* Top Perimeter Clusters */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left: Vitality, Score, Combo & Active Melody */}
        <div className="flex flex-col gap-1.5">
          {mode === 'desafio' ? (
            <>
              <div className="flex items-center gap-1" aria-label={`Vitalidade ${hearts} de ${maxHearts}`}>
                {heartSlots}
              </div>
              <div className="flex items-baseline gap-4">
                <div>
                  <div className="text-[10px] font-bold tracking-[0.2em] text-slate-300 hud-text-stroke">
                    PONTOS
                  </div>
                  <div
                    data-testid="hud-score"
                    className="font-mono-num text-3xl font-extrabold leading-none text-[#fde68a] hud-text-stroke"
                  >
                    {Math.round(score)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold tracking-[0.2em] text-slate-300 hud-text-stroke">
                    COMBO
                  </div>
                  <div
                    data-testid="hud-combo"
                    className="font-mono-num text-2xl font-bold leading-none text-[#5eead4] hud-text-stroke"
                  >
                    x{Math.round(combo)}
                  </div>
                </div>
              </div>
              <div className="mt-0.5 text-xs font-semibold text-slate-200 hud-text-stroke">
                <span className="text-[#fde68a]">
                  {songIndex + 1}/{totalSongs}
                </span>{' '}
                · {activeSong.title}
              </div>
            </>
          ) : (
            <div>
              <div className="text-[10px] font-bold tracking-[0.22em] text-[#5eead4] hud-text-stroke">
                MODO LIVRE
              </div>
              <div className="font-display text-xl font-bold text-[#fde68a] hud-text-stroke">
                Santuário das Melodias
              </div>
              {recognizedSong && (
                <div className="mt-1 inline-block border border-[#fde68a]/70 bg-[#0d1c2e]/90 px-2.5 py-1 text-xs font-bold text-[#fde68a]">
                  ♪ {recognizedSong.title}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Top-Right: Mode Switch & Compact Square Utility Controls */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onSwitchMode(mode === 'desafio' ? 'livre' : 'desafio');
              }}
              className="cursor-pointer border border-[#d4af37]/55 bg-[#0b1726]/90 px-3 py-1.5 text-xs font-bold tracking-wide text-[#fde68a] hover:border-[#fde68a]"
            >
              {mode === 'desafio' ? 'Ir p/ Livre' : 'Ir p/ Desafio'}
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Alternar Placar Global 3D"
              title="Placar Global 3D [T]"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleScoreboard();
              }}
              className={`flex h-9 cursor-pointer items-center gap-1.5 border px-2.5 text-xs font-bold ${
                scoreboardOpen
                  ? 'border-[#5eead4] bg-[#16344a] text-[#5eead4]'
                  : 'border-[#d4af37]/50 bg-[#0b1726]/90 text-[#fde68a] hover:border-[#fde68a]'
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 21h8M12 17v4M6 4h12v5a6 6 0 0 1-12 0V4z" />
              </svg>
              <span className="hidden sm:inline">Placar [T]</span>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label={muted ? 'Ativar Som' : 'Silenciar Som'}
              title="Som [M]"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="flex h-9 w-9 cursor-pointer items-center justify-center border border-slate-600/80 bg-[#0b1726]/90 text-slate-200 hover:border-[#5eead4]"
            >
              {muted ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              )}
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Pausar Jogo"
              title="Pausar [P]"
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              className="flex h-9 w-9 cursor-pointer items-center justify-center border border-slate-600/80 bg-[#0b1726]/90 text-slate-200 hover:border-[#fde68a]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-300 hud-text-stroke">
            {semitoneShift !== 0 && (
              <span className="border border-[#5eead4]/50 bg-[#0b1726]/90 px-2 py-0.5 text-[#5eead4]">
                {semitoneShift > 0 ? '+1♯ Sustenido' : '-1♭ Bemol'}
              </span>
            )}
            {gamepadName && (
              <span className="border border-emerald-400/50 bg-[#0b1726]/90 px-2 py-0.5 text-emerald-300">
                Controle: {gamepadName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Transient Grade Feedback near lower center (non-blocking) */}
      <div className="flex flex-col items-center gap-2">
        {lastFeedback && (
          <div
            key={lastFeedback.id}
            data-testid="hit-feedback"
            className={`font-display text-lg font-extrabold tracking-widest hud-text-stroke ${
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

        {/* Bottom Compact Musical Staff & Tactile Pads */}
        <div className="pointer-events-auto w-full max-w-2xl border border-[#d4af37]/45 bg-[#0a1522]/88 px-3 py-2.5 shadow-xl">
          {mode === 'desafio' ? (
            <div className="relative h-20 w-full overflow-hidden border border-slate-700/70 bg-[#07101b]">
              {/* 5 Musical Staff Lines */}
              {[0, 1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className="absolute right-0 left-0 h-px bg-slate-600/55"
                  style={{ top: `${76 - step * 15}%` }}
                />
              ))}

              {/* Target Golden Hit Zone Line & 5 Line Rings */}
              <div className="absolute top-1 bottom-1 left-[76px] w-1 bg-[#fde68a]" />
              {[0, 1, 2, 3, 4].map((step) => (
                <div
                  key={`ring-${step}`}
                  className="absolute left-[76px] h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#fde68a]/55"
                  style={{ top: `${76 - step * 15}%` }}
                />
              ))}

              {/* Scrolling Beat Notes Container (moved via transform in 60Hz loop) */}
              <div ref={staffTrackRef} className="absolute inset-0 will-change-transform">
                {schedule.map((item) => {
                  const spec = OCARINA_NOTES[item.note];
                  const topPct = 76 - spec.staffStep * 15;
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
                      className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#08111c] text-[11px] font-black text-[#08111c]"
                    >
                      {spec.symbol}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Free Play Note History Bar */}
              <div className="flex h-9 items-center justify-between border border-slate-700/70 bg-[#07101b] px-3">
                <div className="flex items-center gap-2 overflow-hidden">
                  {recentFreeNotes.length === 0 ? (
                    <span className="text-xs text-slate-400">
                      Toque os furos na Ocarina 3D ou use Setas / Espaço para descobrir melodias...
                    </span>
                  ) : (
                    recentFreeNotes.slice(-10).map((nid, idx) => {
                      const spec = OCARINA_NOTES[nid];
                      return (
                        <span
                          key={`${nid}-${idx}`}
                          style={{ backgroundColor: spec.colorHex }}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#08111c] text-xs font-black text-[#08111c]"
                        >
                          {spec.symbol}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Songbook Reference Strip */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
                {OCARINA_SONGS.map((song) => (
                  <div
                    key={song.id}
                    className="flex items-center gap-1 border border-slate-700/70 bg-[#0f1f31] px-2 py-0.5 text-slate-200"
                  >
                    <span className="font-semibold text-[#fde68a]">{song.title.split(' ')[0]}:</span>
                    <span className="tracking-tight text-[#5eead4]">
                      {song.sequence.map((n) => OCARINA_NOTES[n].symbol).join('')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tactile Note Buttons (Mirror 3D Holes 1-to-1) */}
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {NOTE_ORDER.map((id) => {
              const spec = OCARINA_NOTES[id];
              const isHeld = heldNotes.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  tabIndex={-1}
                  data-testid={`note-pad-${id}`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.blur();
                    onPadPress(id);
                  }}
                  onPointerUp={() => onPadRelease(id)}
                  onPointerLeave={() => {
                    if (isHeld) onPadRelease(id);
                  }}
                  style={{
                    borderColor: isHeld ? '#ffffff' : spec.colorHex,
                    backgroundColor: isHeld ? spec.colorHex : '#0f1e30',
                    color: isHeld ? '#08111c' : '#f8fafc',
                  }}
                  className="flex h-11 cursor-pointer flex-col items-center justify-center border-2 transition-transform active:scale-95"
                >
                  <span className="text-sm font-black leading-none">{spec.symbol}</span>
                  <span className="mt-0.5 text-[10px] font-semibold opacity-80">
                    {spec.pitchName} · {spec.keyHint.split(' / ')[0]}
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
