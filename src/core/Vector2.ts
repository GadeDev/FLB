export class Vec2 {
  x: number;
  y: number;

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
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

  len(): number {
    return Math.hypot(this.x, this.y);
  }

  norm(): Vec2 {
    const l = this.len();
    if (l <= 1e-9) return new Vec2(0, 0);
    return new Vec2(this.x / l, this.y / l);
  }

  dist(v: Vec2): number {
    return Math.hypot(this.x - v.x, this.y - v.y);
  }

  static from(obj: { x: number; y: number }): Vec2 {
    return new Vec2(obj.x, obj.y);
  }
}
