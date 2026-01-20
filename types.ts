export enum NodeType {
  NORMAL = 0,
  GOLD = 1,
  HAZARD = 2,
  HOLD = 3
}

export interface LevelPoint {
  x: number;
  y: number;
  z: number;
  t: NodeType;
  time: number;     // Spawn time in seconds
  duration?: number; // For HOLD nodes
}

export interface LevelData {
  id: string;
  name: string;
  color: number;
  bpm: number;
  duration: number; // Total length in seconds
  pts: LevelPoint[];
}

export interface GameStats {
  score: number;
  combo: number;
  maxCombo: number;
  hp: number;
  accuracy: number;
  hits: number;
  totalNotes: number;
}

export enum GameState {
  MENU = 'MENU',
  COUNTDOWN = 'COUNTDOWN', // New State
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
  ALL_CLEARED = 'ALL_CLEARED'
}

export interface GameSettings {
  reduceMotion: boolean;
  colorblindMode: boolean;
  audioLatency: number; // ms
}

export type HitGrade = 'PERFECT' | 'GOOD' | 'MISS';