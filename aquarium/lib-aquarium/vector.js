const isNumber = (value) => typeof value === "number";

const vectorLike = (value) =>
  value instanceof Vector2 ||
  (value !== null &&
    typeof value === "object" &&
    isNumber(value.x) &&
    isNumber(value.y));

const asVector = (value) => {
  if (!vectorLike(value)) {
    throw new TypeError("Expected a Vector2-like value with numeric x and y");
  }
  return value;
};

const asScalar = (value) => {
  if (!isNumber(value)) {
    throw new TypeError("Expected a numeric scalar");
  }
  return value;
};

export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  clone() {
    return new Vector2(this.x, this.y);
  }

  copy() {
    return this.clone();
  }

  assign(value) {
    const vector = asVector(value);
    this.x = vector.x;
    this.y = vector.y;
    return this;
  }

  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  isEmpty() {
    return this.x === 0 && this.y === 0;
  }

  equals(value) {
    const vector = asVector(value);
    return this.x === vector.x && this.y === vector.y;
  }

  notEquals(value) {
    return !this.equals(value);
  }

  add(value) {
    if (isNumber(value)) {
      return new Vector2(this.x + value, this.y + value);
    }
    const vector = asVector(value);
    return new Vector2(this.x + vector.x, this.y + vector.y);
  }

  subtract(value) {
    if (isNumber(value)) {
      return new Vector2(this.x - value, this.y - value);
    }
    const vector = asVector(value);
    return new Vector2(this.x - vector.x, this.y - vector.y);
  }

  multiply(value) {
    const scalar = asScalar(value);
    return new Vector2(this.x * scalar, this.y * scalar);
  }

  divide(value) {
    const scalar = asScalar(value);
    return new Vector2(this.x / scalar, this.y / scalar);
  }

  addSelf(value) {
    if (isNumber(value)) {
      this.x += value;
      this.y += value;
      return this;
    }
    const vector = asVector(value);
    this.x += vector.x;
    this.y += vector.y;
    return this;
  }

  subtractSelf(value) {
    if (isNumber(value)) {
      this.x -= value;
      this.y -= value;
      return this;
    }
    const vector = asVector(value);
    this.x -= vector.x;
    this.y -= vector.y;
    return this;
  }

  multiplySelf(value) {
    const scalar = asScalar(value);
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  divideSelf(value) {
    const scalar = asScalar(value);
    this.x /= scalar;
    this.y /= scalar;
    return this;
  }

  rotate(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const tx = this.x * c - this.y * s;
    const ty = this.x * s + this.y * c;
    this.x = tx;
    this.y = ty;
    return this;
  }

  normalize() {
    const currentLength = this.length();
    if (currentLength === 0) {
      return this;
    }
    return this.multiplySelf(1.0 / currentLength);
  }

  dist(value) {
    const vector = asVector(value);
    return new Vector2(vector.x - this.x, vector.y - this.y).length();
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  mag() {
    return this.length();
  }

  magSq() {
    return this.x * this.x + this.y * this.y;
  }

  truncate(length) {
    const angle = Math.atan2(this.y, this.x);
    this.x = length * Math.cos(angle);
    this.y = length * Math.sin(angle);
    return this;
  }

  ortho() {
    return new Vector2(this.y, -this.x);
  }

  heading() {
    return Math.atan2(this.y, this.x);
  }

  limit(max) {
    if (this.magSq() > max * max) {
      this.normalize();
      this.multiplySelf(max);
    }
    return this;
  }

  setMag(magnitude) {
    this.normalize();
    this.multiplySelf(magnitude);
    return this;
  }

  setAngle(angle) {
    const diff = angle - this.heading();
    return this.rotate(diff);
  }

  lerp(start, end, t) {
    return Vector2.lerp(start, end, t);
  }

  lerpTo(end, t) {
    return Vector2.lerp(this, end, t);
  }

  toArray() {
    return [this.x, this.y];
  }

  toJSON() {
    return { x: this.x, y: this.y };
  }

  static dot(v1, v2) {
    const a = asVector(v1);
    const b = asVector(v2);
    return a.x * b.x + a.y * b.y;
  }

  static cross(v1, v2) {
    const a = asVector(v1);
    const b = asVector(v2);
    return a.x * b.y - a.y * b.x;
  }

  static fromAngle(angle) {
    return new Vector2(Math.cos(angle), Math.sin(angle));
  }

  static lerp(start, end, t) {
    const a = asVector(start);
    const b = asVector(end);
    return new Vector2((1 - t) * a.x + t * b.x, (1 - t) * a.y + t * b.y);
  }

  static zero() {
    return new Vector2(0, 0);
  }
}

export const PVector = Vector2;

export const fromAngle = Vector2.fromAngle;
export const dot = Vector2.dot;
export const cross = Vector2.cross;
export const lerpVector = Vector2.lerp;

export default Vector2;

