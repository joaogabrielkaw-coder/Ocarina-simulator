import React from 'react';
import { GameMode } from '../game/musicData';

interface TitleOverlayProps {
  onStart: (mode: GameMode) => void;
  onOpenScoreboard: () => void;
  bestLocalScore: number;
  cloudTopScore: number | null;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  onStart,
  onOpenScoreboard,
  bestLocalScore,
  cloudTopScore,
}) => {
  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-12">
      {/* Upper-left calm negative-space lockup */}
      <div className="pointer-events-auto max-w-xl pt-2 md:pt-6">
        <svg
          viewBox="0 0 490 156"
          className="w-full max-w-[440px] drop-shadow-[0_6px_18px_rgba(0,0,0,0.65)]"
          role="img"
          aria-label="Ocarina Simulator"
        >
          {/* Golden Triforce & Ocarina Crest */}
          <g transform="translate(8, 12)">
            <polygon
              points="36,4 50,28 22,28"
              fill="#f4c44e"
              stroke="#09131f"
              strokeWidth="2.5"
            />
            <polygon
              points="21,30 35,54 7,54"
              fill="#f4c44e"
              stroke="#09131f"
              strokeWidth="2.5"
            />
            <polygon
              points="51,30 65,54 37,54"
              fill="#f4c44e"
              stroke="#09131f"
              strokeWidth="2.5"
            />
            <circle cx="36" cy="34" r="4" fill="#5eead4" stroke="#09131f" strokeWidth="1.5" />
          </g>

          <text
            x="88"
            y="52"
            fill="#fde68a"
            stroke="#08111c"
            strokeWidth="5"
            style={{
              fontFamily: "'Cinzel', Georgia, serif",
              fontWeight: 800,
              fontSize: '42px',
              letterSpacing: '0.06em',
              paintOrder: 'stroke fill',
            }}
          >
            OCARINA
          </text>
          <text
            x="90"
            y="88"
            fill="#5eead4"
            stroke="#08111c"
            strokeWidth="4"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '23px',
              letterSpacing: '0.28em',
              paintOrder: 'stroke fill',
            }}
          >
            SIMULATOR
          </text>
          <line x1="90" y1="102" x2="365" y2="102" stroke="#d4af37" strokeWidth="2" strokeOpacity="0.65" />
          <text
            x="90"
            y="124"
            fill="#cbd5e1"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600,
              fontSize: '13px',
              letterSpacing: '0.1em',
            }}
          >
            TEMPLO DAS MELODIAS · EDIÇÃO LOW-POLY 3D
          </text>
        </svg>

        {(bestLocalScore > 0 || cloudTopScore !== null) && (
          <div className="mt-2 flex items-center gap-5 text-xs font-semibold tracking-wider text-slate-200 hud-text-stroke">
            {bestLocalScore > 0 && (
              <span>
                SEU RECORDE: <strong className="font-mono-num text-[#fde68a]">{bestLocalScore}</strong>
              </span>
            )}
            {cloudTopScore !== null && cloudTopScore > 0 && (
              <span>
                LÍDER GLOBAL: <strong className="font-mono-num text-[#5eead4]">{cloudTopScore}</strong>
              </span>
            )}
          </div>
        )}

        {/* Primary CTA + max 2 secondary actions */}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStart('desafio');
            }}
            className="cursor-pointer border-2 border-[#fde68a] bg-[#d4af37] px-7 py-3.5 text-base font-bold tracking-wide text-[#09131f] shadow-[0_6px_0_#7c5c10] transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
          >
            Iniciar Desafio Musical
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onStart('livre');
            }}
            className="cursor-pointer border border-[#5eead4]/55 bg-[#0d1c2e]/90 px-5 py-3.5 text-sm font-semibold text-[#d9f9f5] transition-colors hover:border-[#5eead4] hover:bg-[#132942]"
          >
            Modo Livre
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenScoreboard();
            }}
            className="cursor-pointer border border-[#d4af37]/50 bg-[#0d1c2e]/90 px-5 py-3.5 text-sm font-semibold text-[#fde68a] transition-colors hover:border-[#d4af37] hover:bg-[#132942]"
          >
            Placar Global
          </button>
        </div>
      </div>

      {/* Single flat borderless control hint line */}
      <div className="text-center text-xs font-medium tracking-wide text-slate-300/90 hud-text-stroke">
        Toque nos furos 3D ou use Setas / WASD + Espaço · Shift/Alt Meio-Tom · Controle Gamepad · Enter Iniciar
      </div>
    </div>
  );
};
