import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import type { LeaderboardEntry } from '../services/leaderboardService';

interface LeaderboardDrawerProps {
  open: boolean;
  entries: LeaderboardEntry[];
  loading: boolean;
  user: User | null;
  playerName: string;
  onChangePlayerName: (name: string) => void;
  onSaveNickname: (name: string) => Promise<void>;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onClose: () => void;
}

export const LeaderboardDrawer: React.FC<LeaderboardDrawerProps> = ({
  open,
  entries,
  loading,
  user,
  playerName,
  onChangePlayerName,
  onSaveNickname,
  onSignIn,
  onSignOut,
  onClose,
}) => {
  const [savingName, setSavingName] = useState(false);
  const [nameFeedback, setNameFeedback] = useState<string | null>(null);

  if (!open) return null;

  const handleNicknameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim().length < 2) {
      setNameFeedback('Use pelo menos 2 caracteres.');
      return;
    }
    setSavingName(true);
    setNameFeedback(null);
    try {
      await onSaveNickname(playerName.trim());
      setNameFeedback('Nome atualizado no placar!');
    } catch {
      setNameFeedback('Erro ao salvar nome.');
    } finally {
      setSavingName(false);
    }
  };

  return (
    <aside
      aria-label="Placar Global na Nuvem"
      className="fixed top-[max(0.75rem,env(safe-area-inset-top))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] z-30 flex w-[min(410px,calc(100vw-1.5rem))] flex-col border-2 border-[#d4af37]/75 bg-[#0b1726]/95 p-4 shadow-2xl sm:top-4 sm:bottom-4 sm:left-4 sm:w-[min(410px,calc(100vw-2rem))] sm:p-5"
    >
      <div className="flex items-start justify-between border-b border-[#d4af37]/30 pb-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.22em] text-[#5eead4] uppercase">
            Ranking Mundial · Nuvem
          </p>
          <h2 className="font-display text-xl font-bold text-[#fde68a]">
            PLACAR GLOBAL 3D
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar Placar"
          className="cursor-pointer border border-slate-600 px-2.5 py-1 text-xs font-bold text-slate-200 hover:border-[#fde68a]"
        >
          Fechar
        </button>
      </div>

      {/* Cloud Auth & Nickname Card */}
      <div className="mt-3 border border-slate-700/80 bg-[#0f1f33] p-3">
        {user ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#5eead4]">
                Conectado: {user.displayName || 'Músico'}
              </span>
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="cursor-pointer text-[11px] font-medium text-slate-400 underline hover:text-white"
              >
                Sair
              </button>
            </div>
            <form onSubmit={(e) => void handleNicknameSubmit(e)} className="flex gap-1.5">
              <label htmlFor="player-nickname" className="sr-only">
                Apelido no Placar
              </label>
              <input
                id="player-nickname"
                type="text"
                maxLength={24}
                minLength={2}
                value={playerName}
                onChange={(e) => onChangePlayerName(e.target.value)}
                placeholder="Seu nome no placar..."
                className="min-w-0 flex-1 border border-slate-600 bg-[#08121e] px-2.5 py-1.5 text-xs text-white focus:border-[#5eead4] focus:outline-none"
              />
              <button
                type="submit"
                disabled={savingName}
                className="cursor-pointer border border-[#d4af37] bg-[#d4af37] px-3 py-1.5 text-xs font-bold text-[#09131f] hover:bg-[#fde68a] disabled:opacity-50"
              >
                {savingName ? '...' : 'Salvar'}
              </button>
            </form>
            {nameFeedback && <p className="text-[11px] text-[#fde68a]">{nameFeedback}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-slate-300">
              Entre com Google para registrar sua pontuação no monólito 3D e competir globalmente.
            </p>
            <button
              type="button"
              onClick={() => void onSignIn()}
              className="cursor-pointer border border-[#5eead4]/75 bg-[#153147] py-2 text-xs font-bold text-[#5eead4] hover:bg-[#1c415e]"
            >
              Entrar com Google
            </button>
          </div>
        )}
      </div>

      {/* Rankings List */}
      <div className="hyrule-scroll mt-3 flex-1 overflow-y-auto pr-1">
        {loading ? (
          <p className="py-8 text-center text-xs text-slate-400">
            Consultando inscrições do templo...
          </p>
        ) : entries.length === 0 ? (
          <div className="border border-dashed border-slate-700 py-8 text-center text-xs text-slate-400">
            Nenhuma pontuação registrada na nuvem ainda. Seja o primeiro mestre!
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {entries.map((entry, idx) => {
              const isMe = user?.uid === entry.uid;
              return (
                <div
                  key={entry.uid}
                  className={`flex items-center justify-between border px-3 py-2 ${
                    isMe
                      ? 'border-[#5eead4] bg-[#132d42]'
                      : idx === 0
                        ? 'border-[#d4af37]/65 bg-[#172436]'
                        : 'border-slate-800 bg-[#0d1929]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span
                      className={`font-mono-num w-7 text-sm font-extrabold ${
                        idx === 0
                          ? 'text-[#fbbf24]'
                          : idx === 1
                            ? 'text-slate-200'
                            : idx === 2
                              ? 'text-amber-500'
                              : 'text-slate-400'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-100">
                        {entry.playerName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Combo x{Math.round(entry.bestCombo)} · {Math.round(entry.accuracy)}% ·{' '}
                        {entry.songsCompleted} mús.
                      </div>
                    </div>
                  </div>
                  <div className="font-mono-num text-base font-extrabold text-[#5eead4]">
                    {Math.round(entry.score)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px] text-slate-400">
        Veja também o Top 5 gravado ao vivo no Monólito de Pedra 3D à direita.
      </p>
    </aside>
  );
};
