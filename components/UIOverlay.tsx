import React, { useMemo, useState, useEffect } from 'react';
import { Camera, Play, RefreshCw, ChevronRight, Settings, Check, X } from 'lucide-react';
import { GameState, GameStats, LevelData, GameSettings } from '../types';
import { audio } from '../services/AudioService';

interface UIProps {
  gameState: GameState;
  currentLevel: LevelData;
  stats: GameStats;
  settings: GameSettings;
  camActive: boolean;
  onStart: () => void;
  onNextLevel: () => void;
  onRetry: () => void;
  onToggleCam: () => void;
  onUpdateSettings: (s: GameSettings) => void;
  onCountdownFinish: () => void;
}

export const UIOverlay: React.FC<UIProps> = ({
  gameState,
  currentLevel,
  stats,
  settings,
  camActive,
  onStart,
  onNextLevel,
  onRetry,
  onToggleCam,
  onUpdateSettings,
  onCountdownFinish
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [countdown, setCountdown] = useState(3);
  
  // Progress Bar Logic
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (gameState === GameState.COUNTDOWN) {
        setCountdown(3);
        const int = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(int);
                    onCountdownFinish();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(int);
    }
  }, [gameState, onCountdownFinish]);

  useEffect(() => {
      if(gameState === GameState.PLAYING) {
          const start = Date.now();
          const int = setInterval(() => {
             const elapsed = (Date.now() - start) / 1000;
             setProgress(Math.min(100, (elapsed / currentLevel.duration) * 100));
          }, 100);
          return () => clearInterval(int);
      } else {
          setProgress(0);
      }
  }, [gameState, currentLevel]);

  const accentColor = useMemo(() => '#' + currentLevel.color.toString(16).padStart(6, '0'), [currentLevel.color]);
  const healthBlocks = useMemo(() => Array.from({ length: 10 }).map((_, i) => i < Math.ceil((stats.hp / 100) * 10)), [stats.hp]);

  const handleStartClick = () => {
      audio.init();
      audio.resume();
      onStart();
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10 font-sans select-none">
      
      {/* COUNTDOWN OVERLAY */}
      {gameState === GameState.COUNTDOWN && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm">
              <div className="text-[15vw] font-black italic text-stroke-2 animate-pulse" style={{ color: accentColor }}>
                  {countdown > 0 ? countdown : "GO!"}
              </div>
          </div>
      )}

      {/* HUD (Play Mode) */}
      <div className={`absolute inset-0 flex flex-col justify-between p-6 transition-opacity ${gameState !== GameState.PLAYING ? 'opacity-0' : 'opacity-100'}`}>
        
        {/* Top HUD */}
        <div className="flex justify-between items-start">
           <div>
              <h1 className="text-4xl font-black italic tracking-tighter" style={{ color: accentColor }}>{currentLevel.name}</h1>
              <div className="text-white/60 text-sm font-bold tracking-widest mt-1">ACCURACY: {stats.accuracy}%</div>
           </div>
           <div className="text-right">
              <div className="text-3xl font-mono font-bold text-white tracking-widest">{stats.score.toString().padStart(6, '0')}</div>
           </div>
        </div>

        {/* Progress Bar (Top Center) */}
        <div className="absolute top-0 left-0 w-full h-1 bg-white/10">
            <div className="h-full transition-all duration-200 ease-linear" style={{ width: `${progress}%`, backgroundColor: accentColor, boxShadow: `0 0 10px ${accentColor}` }} />
        </div>

        {/* Bottom HUD */}
        <div className="flex justify-between items-end">
           <div className="flex flex-col gap-2">
               <div className="text-xs font-bold text-white/40 tracking-widest">INTEGRITY</div>
               <div className="flex gap-1">
                  {healthBlocks.map((filled, i) => (
                      <div key={i} className={`w-3 h-6 skew-x-[-20deg] border border-white/10 ${filled ? 'bg-current shadow-[0_0_10px_currentColor]' : ''}`}
                           style={{ color: filled ? (stats.hp < 30 ? '#ff0055' : accentColor) : 'transparent' }} />
                  ))}
               </div>
           </div>
           
           <div className="text-right">
               <div className="text-xs font-bold text-white/40 tracking-widest mb-1">COMBO CHAIN</div>
               <div className="text-6xl font-black italic text-stroke-2" style={{ color: 'transparent', WebkitTextStrokeColor: accentColor }}>
                  {stats.combo}x
               </div>
           </div>
        </div>
      </div>

      {/* SETTINGS TOGGLE */}
      <div className="absolute top-6 right-6 pointer-events-auto z-50">
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 bg-black/50 border border-white/20 text-white hover:bg-white hover:text-black transition">
             {showSettings ? <X size={20}/> : <Settings size={20}/>}
          </button>
      </div>

      {/* SETTINGS MENU */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/90 z-40 flex items-center justify-center pointer-events-auto backdrop-blur">
            <div className="w-96 border border-neon-blue p-8">
                <h2 className="text-2xl font-black text-neon-blue mb-6">SYSTEM_CONFIG</h2>
                <div className="space-y-4">
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-white tracking-widest">REDUCE MOTION</span>
                        <div className={`w-12 h-6 border ${settings.reduceMotion ? 'bg-neon-blue' : 'bg-transparent'} relative transition`}
                             onClick={() => onUpdateSettings({...settings, reduceMotion: !settings.reduceMotion})}>
                             <div className={`absolute top-0.5 bottom-0.5 w-5 bg-white transition-all ${settings.reduceMotion ? 'right-0.5' : 'left-0.5'}`} />
                        </div>
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-white tracking-widest">COLORBLIND MODE</span>
                        <div className={`w-12 h-6 border ${settings.colorblindMode ? 'bg-neon-blue' : 'bg-transparent'} relative transition`}
                             onClick={() => onUpdateSettings({...settings, colorblindMode: !settings.colorblindMode})}>
                             <div className={`absolute top-0.5 bottom-0.5 w-5 bg-white transition-all ${settings.colorblindMode ? 'right-0.5' : 'left-0.5'}`} />
                        </div>
                    </label>
                    <div className="pt-4 border-t border-white/10">
                        <span className="text-white/50 text-xs">AUDIO LATENCY: {settings.audioLatency}ms</span>
                        <input type="range" min="0" max="500" value={settings.audioLatency} 
                            onChange={(e) => onUpdateSettings({...settings, audioLatency: Number(e.target.value)})}
                            className="w-full mt-2 accent-neon-blue"
                        />
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* MAIN MENU */}
      {gameState === GameState.MENU && !showSettings && (
        <div className="absolute inset-0 bg-neon-dark z-30 flex flex-col items-center justify-center pointer-events-auto">
           <h1 className="text-[10vw] font-black italic tracking-tighter leading-none text-white mix-blend-difference mb-8 animate-glitch">
             NEON<span className="text-stroke-2">DIVE</span>
           </h1>
           <button onClick={handleStartClick} className="group flex items-center gap-4 text-2xl font-bold tracking-[0.3em] text-white hover:text-neon-green transition-colors">
             <span className="w-12 h-12 flex items-center justify-center border border-current group-hover:bg-neon-green group-hover:text-black"><Play size={20} /></span>
             START_GAME
           </button>
           <div className="mt-8 flex gap-4 text-xs tracking-widest text-white/40">
               <button onClick={onToggleCam} className="hover:text-white uppercase flex items-center gap-2">
                   <Camera size={14} /> {camActive ? "CAM: ACTIVE" : "CAM: OFF"}
               </button>
               <span>|</span>
               <span>MOUSE: ACTIVE</span>
           </div>
        </div>
      )}

      {/* GAME OVER / COMPLETE */}
      {(gameState === GameState.GAME_OVER || gameState === GameState.LEVEL_COMPLETE) && (
        <div className="absolute inset-0 bg-black/95 z-30 flex flex-col items-center justify-center pointer-events-auto">
           <h2 className="text-6xl font-black italic mb-2">{gameState === GameState.GAME_OVER ? 'SYSTEM FAILURE' : 'DATA SECURED'}</h2>
           <div className="text-2xl font-mono text-neon-blue mb-8 tracking-widest">
               SCORE: {stats.score} <span className="text-white/50 mx-2">|</span> ACC: {stats.accuracy}%
           </div>
           <div className="flex gap-4">
              <button onClick={() => { audio.resume(); onRetry(); }} className="px-8 py-4 border border-white hover:bg-white hover:text-black font-bold tracking-widest">RETRY</button>
              {gameState === GameState.LEVEL_COMPLETE && (
                <button onClick={() => { audio.resume(); onNextLevel(); }} className="px-8 py-4 bg-neon-green text-black font-bold hover:bg-white tracking-widest flex items-center gap-2">
                    NEXT LEVEL <ChevronRight size={20} />
                </button>
              )}
           </div>
        </div>
      )}
    </div>
  );
};