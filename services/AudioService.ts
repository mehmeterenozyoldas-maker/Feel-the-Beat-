export class AudioSys {
  ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  
  // Rhythm backing
  private nextNoteTime = 0;
  private isPlaying = false;
  private bpm = 120;
  private timerID: number | null = null;
  private startTimeOffset = 0;

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AC();
    if (!this.ctx) return;
    
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0.3;
    
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 8000;

    // Analyzer for visuals
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 64; // Low res for performance
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    this.gain.connect(this.filter);
    this.filter.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    
    // Fallback if context doesn't start
    this.startTimeOffset = Date.now() / 1000;
  }
  
  resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(e => console.error(e));
      }
  }

  // Get energy level (0-1) for visual reactivity
  getEnergy(): number {
    if (!this.analyser || !this.dataArray) return 0;
    this.analyser.getByteFrequencyData(this.dataArray);
    let sum = 0;
    // Focus on bass frequencies (lower bins)
    for(let i = 0; i < 5; i++) {
      sum += this.dataArray[i];
    }
    return sum / (5 * 255);
  }

  getCurrentTime(): number {
    // If context exists and is running, use it
    if (this.ctx && this.ctx.state === 'running') {
        return this.ctx.currentTime;
    }
    // Fallback to simple date time if audio is broken/suspended
    return (Date.now() / 1000) - this.startTimeOffset;
  }

  // --- RHYTHM ENGINE ---

  startMusic(bpm: number) {
    if (!this.ctx) this.init();
    this.resume();
    
    this.bpm = bpm;
    this.isPlaying = true;
    this.nextNoteTime = this.getCurrentTime() + 0.1;
    this.scheduler();
  }

  stopMusic() {
    this.isPlaying = false;
    if (this.timerID) window.clearTimeout(this.timerID);
  }

  private scheduler() {
    if (!this.isPlaying) return;
    
    const currentTime = this.getCurrentTime();

    // Schedule ahead
    while (this.nextNoteTime < currentTime + 0.1) {
      this.scheduleNote(this.nextNoteTime);
      this.nextNoteTime += (60.0 / this.bpm); // Quarter note
    }
    this.timerID = window.setTimeout(() => this.scheduler(), 25);
  }

  private scheduleNote(time: number) {
    if (!this.ctx) return;
    
    // Simple Kick Drum
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
    
    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
    
    osc.connect(gain);
    if(this.analyser) gain.connect(this.analyser);
    
    osc.start(time);
    osc.stop(time + 0.5);
  }

  // --- SFX ---

  playTone(freq: number, type: OscillatorType, dur: number, detune = 0, vol = 1.0, time?: number) {
    if (!this.ctx || !this.gain) return;
    const t = time || this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.detune.value = detune;

    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.01, t + dur);

    o.connect(g);
    g.connect(this.gain);
    
    o.start(t);
    o.stop(t + dur);
  }

  playSynth(freq: number, dur: number, isBad = false) {
    if(isBad) {
        this.playTone(freq, 'sawtooth', dur, 0, 0.8);
        this.playTone(freq - 50, 'sawtooth', dur, 10, 0.6); 
    } else {
        this.playTone(freq, 'square', dur, 0, 0.4);
        this.playTone(freq, 'sawtooth', dur, 5, 0.4); 
        this.playTone(freq * 0.5, 'triangle', dur + 0.1, 0, 0.6); 
    }
  }

  hit(isGold: boolean) {
    const base = isGold ? 880 : 440; 
    const high = isGold ? 1760 : 880;
    this.playSynth(base, 0.2);
    if(isGold) setTimeout(() => this.playSynth(high, 0.3), 80); 
  }

  hitHold() {
     // Continuous hum for hold
     this.playTone(220, 'sine', 0.1, 0, 0.3);
  }

  miss() {
    this.playSynth(110, 0.4, true); 
  }

  gameOver() {
    this.stopMusic();
    this.playSynth(55, 1.5, true);
  }

  win() {
    this.stopMusic();
    [440, 554, 659, 880].forEach((f, i) => {
        setTimeout(() => this.playSynth(f, 0.6), i * 150);
    });
  }
}

export const audio = new AudioSys();