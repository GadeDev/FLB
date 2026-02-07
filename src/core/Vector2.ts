export class Vec2 {
  constructor(public x: number, public y: number) {}

  static from(v: { x: number; y: number }): Vec2 {
    return new Vec2(v.x, v.y);
  }

  static get zero(): Vec2 {
    return new Vec2(0, 0);
  }

  clone(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  add(v: Vec2): Vec2 {
    return new Vec2(this.x + v.x, this.y + v.y);
  }

  sub(v: Vec2): Vec2 {
    return new Vec2(this.x - v.x, this.y - v.y);
  }

  mul(s: number): Vec2 {
    return new Vec2(this.x * s, this.y * s);
  }

  // ★重要：距離を数値で返す
  dist(v: Vec2): number {
    return Math.hypot(this.x - v.x, this.y - v.y);
  }

  norm(): Vec2 {
    const len = Math.hypot(this.x, this.y);
    return len === 0 ? new Vec2(0, 0) : new Vec2(this.x / len, this.y / len);
  }
}
