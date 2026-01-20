import React, { useState, useCallback } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { UIOverlay } from './components/UIOverlay';
import { LEVELS } from './constants';
import { GameState, GameStats, GameSettings } from './types';

export default function App() {
  const [levelIndex, setLevelIndex] = useState(0);
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [stats, setStats] = useState<GameStats>({ hp: 100, score: 0, combo: 0, maxCombo: 0, accuracy: 100, hits: 0, totalNotes: 0 });
  const [settings, setSettings] = useState<GameSettings>({ reduceMotion: false, colorblindMode: false, audioLatency: 50 });
  const [camActive, setCamActive] = useState(false);

  const startCountdown = () => {
    // Reset Stats on start
    setStats({ hp: 100, score: 0, combo: 0, maxCombo: 0, accuracy: 100, hits: 0, totalNotes: 0 });
    setGameState(GameState.COUNTDOWN);
  };

  const startGame = () => {
    setGameState(GameState.PLAYING);
  };

  const nextLevel = () => {
    if (levelIndex + 1 >= LEVELS.length) setGameState(GameState.ALL_CLEARED);
    else {
      setLevelIndex(prev => prev + 1);
      setStats({ hp: 100, score: 0, combo: 0, maxCombo: 0, accuracy: 100, hits: 0, totalNotes: 0 });
      setGameState(GameState.COUNTDOWN);
    }
  };

  const handleStatsUpdate = useCallback((newStats: GameStats) => {
    // We only update React state occasionally to avoid re-renders, 
    // or let the UI pull from refs if optimization is needed.
    // Here we just pass it through.
    setStats(prev => ({ ...prev, ...newStats }));
  }, []);

  const handleGameEnd = useCallback((success: boolean, finalStats: GameStats) => {
    setStats(prev => ({ ...prev, ...finalStats }));
    setGameState(success ? GameState.LEVEL_COMPLETE : GameState.GAME_OVER);
  }, []);

  const handleRequestCam = useCallback(async (video: HTMLVideoElement) => {
    try {
        setCamActive(true);
        if(video) video.style.opacity = '0.5';
        return true;
    } catch(e) { return false; }
  }, []);

  return (
    <div className="relative w-screen h-screen bg-neon-dark text-white overflow-hidden font-sans">
      <GameCanvas 
        levelIndex={levelIndex}
        gameState={gameState}
        settings={settings}
        onStatsUpdate={handleStatsUpdate}
        onGameEnd={handleGameEnd}
        onRequestCam={handleRequestCam}
      />
      
      <UIOverlay 
        gameState={gameState}
        currentLevel={LEVELS[levelIndex]}
        stats={stats}
        settings={settings}
        camActive={camActive}
        onStart={startCountdown}
        onCountdownFinish={startGame}
        onNextLevel={nextLevel}
        onRetry={startCountdown}
        onToggleCam={() => { /* Handled internally */ }}
        onUpdateSettings={setSettings}
      />
    </div>
  );
}