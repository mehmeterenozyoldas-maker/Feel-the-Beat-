import { LevelData, NodeType } from './types';

// --- PATTERN GENERATOR ---
const generateChart = (bpm: number, durationSeconds: number, seed: number): { pts: any[], totalDur: number } => {
  const pts = [];
  const beatDur = 60 / bpm;
  const totalBeats = Math.floor(durationSeconds / beatDur);
  
  let currentTime = 2.0; // Start offset
  
  // Pattern segments (switch every 8 beats)
  const measures = Math.ceil(totalBeats / 8);

  for (let m = 0; m < measures; m++) {
    // Deterministic pseudo-random based on measure index + seed
    const pRand = Math.sin(m * 12.9898 + seed) * 43758.5453;
    const style = Math.floor(Math.abs(pRand % 4)); // 0: Spiral, 1: Grid Jump, 2: Stream, 3: Mixed
    
    for (let b = 0; b < 8; b++) {
      const globalBeat = m * 8 + b;
      if (currentTime > durationSeconds) break;

      let x = 0, y = 0;
      let type = NodeType.NORMAL;
      let noteDur = 0;

      // --- STYLES ---
      if (style === 0) { 
        // SPIRAL
        const angle = globalBeat * 0.5;
        const rad = 1.5;
        x = Math.cos(angle) * rad;
        y = Math.sin(angle) * rad;
      } 
      else if (style === 1) { 
        // GRID JUMPS (Wide movement)
        const quadrant = globalBeat % 4; // TL, TR, BR, BL
        x = (quadrant === 0 || quadrant === 3) ? -2 : 2;
        y = (quadrant === 0 || quadrant === 1) ? 1.5 : -1.5;
        if (b % 2 === 0) type = NodeType.GOLD; // Accent
      } 
      else if (style === 2) { 
        // VERTICAL STREAM
        x = Math.sin(globalBeat * 0.5) * 2.5;
        y = (b % 2 === 0) ? 0.5 : -0.5;
      }
      else { 
        // MIXED / TECH
        x = (Math.random() - 0.5) * 5;
        y = (Math.random() - 0.5) * 3;
        if (Math.abs(x) < 1 && Math.abs(y) < 1) type = NodeType.HAZARD; // Center hazards
        if (b === 0) { type = NodeType.HOLD; noteDur = beatDur * 2; }
      }

      // Overrides
      if (style !== 3 && Math.random() > 0.9) type = NodeType.HAZARD;
      if (b === 0 && type !== NodeType.HAZARD) type = NodeType.GOLD; // Downbeat gold

      pts.push({
        x, y, z: 0,
        t: type,
        time: currentTime,
        duration: noteDur
      });

      // Increment time (Hold notes take up space)
      const gap = (type === NodeType.HOLD) ? beatDur * 2.5 : beatDur;
      currentTime += gap;
    }
  }
  
  return { pts, totalDur: currentTime + 2 };
};

export const LEVELS: LevelData[] = [
  { 
    id: 'swan', name: "STAGE 1: SWAN LAKE", color: 0x00aaff, bpm: 110, duration: 45,
    pts: generateChart(110, 45, 1).pts
  },
  { 
    id: 'tiktok', name: "STAGE 2: TIKTOK", color: 0xff00ff, bpm: 128, duration: 60,
    pts: generateChart(128, 60, 2).pts
  },
  { 
    id: 'blinding', name: "STAGE 3: LIGHTS", color: 0xffaa00, bpm: 140, duration: 75,
    pts: generateChart(140, 75, 3).pts
  },
  {
    id: 'matrix', name: "STAGE 4: MATRIX", color: 0x00ff00, bpm: 160, duration: 90,
    pts: generateChart(160, 90, 4).pts
  },
  {
    id: 'cyber', name: "STAGE 5: CYBERPUNK", color: 0x00ffff, bpm: 174, duration: 100,
    pts: generateChart(174, 100, 5).pts
  },
  { 
    id: 'chaos', name: "FINAL STAGE: CHAOS", color: 0xff0044, bpm: 190, duration: 120,
    pts: generateChart(190, 120, 6).pts
  }
];