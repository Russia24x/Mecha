'use client';

import { useEffect, useRef } from 'react';

export default function GamePage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useLoadingState();

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;
    let PhaserGameModule: { PhaserGame: { create: (parent: HTMLElement) => unknown; destroy: () => void } } | null = null;

    import('@/game/PhaserGame').then((mod) => {
      if (destroyed || !containerRef.current) return;
      PhaserGameModule = mod;
      mod.PhaserGame.create(containerRef.current);
      setLoading(false);
    }).catch((err) => {
      console.error('Failed to load Phaser game:', err);
    });

    return () => {
      destroyed = true;
      PhaserGameModule?.PhaserGame.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-[1280px] flex flex-col gap-2">
        <div className="flex items-center justify-between px-2 text-[10px] sm:text-xs font-mono text-zinc-500 uppercase tracking-wider">
          <span>MECHA: LAST PROTOCOL — MVP</span>
          <span>PHASER 4.2 · MATTER.JS · WEBGL</span>
        </div>
        <div
          ref={containerRef}
          className="relative w-full aspect-[16/9] bg-black border border-zinc-800 overflow-hidden rounded-lg shadow-[0_0_60px_-15px_rgba(57,208,216,0.3)]"
        />
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
            <div className="text-cyan-400 font-mono text-2xl tracking-widest animate-pulse">MECHA</div>
            <div className="text-zinc-500 font-mono text-xs tracking-wider">LOADING SYSTEMS...</div>
            <div className="w-48 h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}
        <div className="px-2 text-[10px] sm:text-xs font-mono text-zinc-600 flex flex-wrap gap-x-4 gap-y-1">
          <span><span className="text-zinc-400">WASD</span> Move</span>
          <span><span className="text-zinc-400">SPACE</span> Jump</span>
          <span><span className="text-zinc-400">SHIFT</span> Dash</span>
          <span><span className="text-zinc-400">J / LMB</span> Fire</span>
          <span><span className="text-zinc-400">K / RMB</span> Melee</span>
          <span><span className="text-zinc-400">1-4</span> Weapons</span>
          <span><span className="text-zinc-400">ESC</span> Pause</span>
        </div>
      </div>
    </main>
  );
}

// Tiny helper hook to avoid importing useState inline.
import { useState } from 'react';
function useLoadingState(): [boolean, (v: boolean) => void] {
  const [loading, setLoading] = useState(true);
  return [loading, setLoading];
}
