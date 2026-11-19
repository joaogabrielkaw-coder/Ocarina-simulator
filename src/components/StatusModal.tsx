import React from 'react';
import { GamePhase } from '../game/musicData';
import type { User } from 'firebase/auth';

export interface RunSummary {
  score: number;
  bestCombo: number;
  accuracy: number;
  songsCompleted: number;
  victory: boolean;
}

interface StatusModalProps {
  phase: GamePhase;
  summary: RunSummary | null;
  bestLocalScore: number;
  user: User | null;
  cloudSaving: boolean;
  cloudStatusMsg: string | null;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
  onOpenScoreboard: () => void;
  onSignInAndSave: () => void;
}

export const StatusModal: React.FC<StatusModalProps> = ({
  phase,
  summary,
  bestLocalScore,
  user,
  cloudSaving,
  cloudStatusMsg,
  onResume,
  onRestart,
  onReturnTitle,
  onOpenScoreboard,
  onSignInAndSave,
}) => {
  if (phase !== 'paused' && phase !== 'gameover') return null;

  if (phase === 'paused') {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#060d16]/75 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Jogo Pausado"
          className="w-full max-w-sm border-2 border-[#d4af37]/70 bg-[#0e1b2b] p-6 shadow-2xl"
        >
          <h2 className="font-display text-center text-2xl font-bold tracking-wider text-[#fde68a]">
            PAUSADO
          </h2>
          <p className="mt-1 text-center text-xs text-slate-300">
            Pressione Esc ou P para continuar tocando
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onResume();
              }}
              className="cursor-pointer border border-[#fde68a] bg-[#d4af37] py-2.5 text-sm font-bold text-[#09131f] hover:bg-[#fde68a]"
            >
              Retomar Melodia
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="cursor-pointer border border-slate-600 bg-[#15283d] py-2.5 text-sm font-semibold text-slate-100 hover:border-[#5eead4]"
            >
              Reiniciar Desafio
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenScoreboard();
              }}
              className="cursor-pointer border border-[#d4af37]/40 bg-[#15283d] py-2.5 text-sm font-semibold text-[#fde68a] hover:border-[#d4af37]"
            >
              Ver Placar Global 3D
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onReturnTitle();
              }}
              className="cursor-pointer border border-slate-700 bg-transparent py-2 text-xs font-medium text-slate-300 hover:text-white"
            >
              Voltar à Tela Inicial
            </button>
          </div>
        </div>
      </div>
    );
  }

  const run = summary ?? {
    score: 0,
    bestCombo: 0,
    accuracy: 100,
    songsCompleted: 0,
    victory: false,
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#060d16]/78 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={run.victory ? 'Desafio Concluído' : 'Fim de Jogo'}
        className="w-full max-w-md border-2 border-[#d4af37]/80 bg-[#0e1b2b] p-6 shadow-2xl"
      >
        <div className="text-center">
          <p className="text-xs font-bold tracking-[0.22em] text-[#5eead4] uppercase">
            {run.victory ? 'Templo Consagrado' : 'Melodia Interrompida'}
          </p>
          <h2 className="font-display mt-1 text-2xl font-extrabold text-[#fde68a]">
            {run.victory ? 'MESTRE DA OCARINA' : 'FIM DO DESAFIO'}
          </h2>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <div className="border border-slate-700/80 bg-[#09131f] p-3 text-center">
            <div className="text-[11px] font-semibold tracking-wider text-slate-400">
              PONTOS
            </div>
            <div className="font-mono-num mt-0.5 text-xl font-bold text-[#fde68a]">
              {Math.round(run.score)}
            </div>
          </div>
          <div className="border border-slate-700/80 bg-[#09131f] p-3 text-center">
            <div className="text-[11px] font-semibold tracking-wider text-slate-400">
              COMBO MÁX
            </div>
            <div className="font-mono-num mt-0.5 text-xl font-bold text-[#5eead4]">
              x{Math.round(run.bestCombo)}
            </div>
          </div>
          <div className="border border-slate-700/80 bg-[#09131f] p-3 text-center">
            <div className="text-[11px] font-semibold tracking-wider text-slate-400">
              PRECISÃO
            </div>
            <div className="font-mono-num mt-0.5 text-xl font-bold text-slate-100">
              {Math.round(run.accuracy)}%
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border border-slate-800 bg-[#0a1522] px-3 py-2 text-xs text-slate-300">
          <span>
            Músicas concluídas:{' '}
            <strong className="font-mono-num text-white">{run.songsCompleted}</strong>
          </span>
          <span>
            Recorde local:{' '}
            <strong className="font-mono-num text-[#fde68a]">
              {Math.max(bestLocalScore, run.score)}
            </strong>
          </span>
        </div>

        {/* Cloud Save Feedback / Auth CTA */}
        <div className="mt-4 border border-[#d4af37]/30 bg-[#122236] p-3 text-center">
          {user ? (
            <p className="text-xs font-medium text-[#5eead4]">
              {cloudSaving
                ? 'Sincronizando pontuação na nuvem...'
                : cloudStatusMsg || 'Conectado ao Placar Global.'}
            </p>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-slate-300">
                Entre com o Google para enviar sua pontuação ao Placar Global.
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSignInAndSave();
                }}
                className="cursor-pointer border border-[#5eead4]/70 bg-[#16344a] px-4 py-1.5 text-xs font-bold text-[#5eead4] hover:bg-[#1e4663]"
              >
                Entrar com Google e Salvar
              </button>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onRestart();
            }}
            className="flex-1 cursor-pointer border border-[#fde68a] bg-[#d4af37] py-2.5 text-sm font-bold text-[#09131f] hover:bg-[#fde68a]"
          >
            Jogar Novamente
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenScoreboard();
            }}
            className="flex-1 cursor-pointer border border-[#5eead4]/55 bg-[#15283d] py-2.5 text-sm font-semibold text-[#d9f9f5] hover:border-[#5eead4]"
          >
            Placar Global
          </button>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onReturnTitle();
          }}
          className="mt-2.5 w-full cursor-pointer py-1.5 text-xs font-medium text-slate-400 hover:text-white"
        >
          Tela Inicial
        </button>
      </div>
    </div>
  );
};
