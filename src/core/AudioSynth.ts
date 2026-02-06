export class AudioSynth {
  private ctx: AudioContext;
  private enabled = true;

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  setEnabled(v: boolean) { this.enabled = v; }

  play(type: 'tap' | 'kick' | 'intercept' | 'goal' | 'whistle' | 'draw') {
    if (!this.enabled) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();

    const t = this.ctx.currentTime;

    const oneShot = (freq: number, dur: number, gainVal: number, oscType: OscillatorType = 'sine') => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = oscType;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(gainVal, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
    };

    switch (type) {
      case 'tap':
        oneShot(800, 0.08, 0.08, 'sine');
        break;

      case 'draw':
        oneShot(520, 0.12, 0.08, 'triangle');
        break;

      case 'kick': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.18);
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.18);
        break;
      }

      case 'intercept':
        oneShot(120, 0.22, 0.10, 'square');
        break;

      case 'whistle': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(2000, t);
        osc.frequency.linearRampToValueAtTime(1600, t + 0.12);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.linearRampToValueAtTime(0.0, t + 0.28);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.28);
        break;
      }

      case 'goal': {
        // simple arpeggio
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.connect(g);
          g.connect(this.ctx.destination);
          o.type = 'sine';
          o.frequency.value = freq;
          const ti = t + i * 0.08;
          g.gain.setValueAtTime(0.09, ti);
          g.gain.linearRampToValueAtTime(0.0, ti + 0.45);
          o.start(ti);
          o.stop(ti + 0.45);
        });
        break;
      }
    }
  }
}
