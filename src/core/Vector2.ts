export class Vec2 {
  constructor(public x: number, public y: number) {}
  static get zero() { return new Vec2(0, 0); }
  add(v: Vec2) { return new Vec2(this.x + v.x, this.y + v.y); }
  sub(v: Vec2) { return new Vec2(this.x - v.x, this.y - v.y); }
  mul(s: number) { return new Vec2(this.x * s, this.y * s); }
  len() { return Math.sqrt(this.x * this.x + this.y * this.y); }
  norm() { const l = this.len(); return l === 0 ? Vec2.zero : this.mul(1 / l); }
  dist(v: Vec2) { return this.sub(v).len(); }
  
  // 線分(p1-p2)と点(p)の最短距離
  static distSegmentPoint(p1: Vec2, p2: Vec2, p: Vec2): number {
    const l2 = p1.dist(p2) ** 2;
    if (l2 === 0) return p1.dist(p);
    let t = ((p.x - p1.x) * (p2.x - p1.x) + (p.y - p1.y) * (p2.y - p1.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const proj = new Vec2(p1.x + t * (p2.x - p1.x), p1.y + t * (p2.y - p1.y));
    return p.dist(proj);
  }
}
