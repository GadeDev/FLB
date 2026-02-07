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

  dist(v: Vec2): Vec2 { // 距離ではなくベクトルを返すわけではないが、型合わせ
    // 注: distは数値を返すべきですが、今回は簡易的にnumberを返すメソッドとして定義
    return Math.hypot(this.x - v.x, this.y - v.y) as any; 
  }
  // ※修正: 上記distの型定義が既存コードと競合しないよう、
  // simulator側で dist(v) を number として扱っているので、ここでは正しい実装を提供します。
}

// 修正版 Vector2 (distがnumberを返す正しい形)
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

  dist(v: Vec2): number {
    return Math.hypot(this.x - v.x, this.y - v.y);
  }

  norm(): Vec2 {
    const len = Math.hypot(this.x, this.y);
    return len === 0 ? new Vec2(0, 0) : new Vec2(this.x / len, this.y / len);
  }
}
