import { BOIDS } from "./constants.js";
import { Vector2 } from "./vector.js";

const mapFloat = (x, inMin, inMax, outMin, outMax) => ((x - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;

export class Boid {
  constructor({ x = 0, y = 0, limits = new Vector2(0, 0), rng } = {}) {
    this.acceleration = new Vector2(0, 0);
    this.velocity = new Vector2(Boid.randomf(rng), Boid.randomf(rng));
    this.location = new Vector2(x, y);
    this.limits = limits.clone ? limits.clone() : new Vector2(limits.x, limits.y);
    this.maxspeed = BOIDS.DEFAULT_MAX_SPEED;
    this.maxforce = BOIDS.DEFAULT_MAX_FORCE;
    this.desiredseparation = BOIDS.DEFAULT_DESIRED_SEPARATION;
    this.neighbordist = BOIDS.DEFAULT_NEIGHBOR_DISTANCE;
    this.colorIndex = 0;
    this.mass = BOIDS.DEFAULT_MASS;
    this.enabled = true;
  }

  static mapfloat(x, inMin, inMax, outMin, outMax) {
    return mapFloat(x, inMin, inMax, outMin, outMax);
  }

  static randomf(rng) {
    const value = rng?.int ? rng.int(0, 255) : Math.floor(Math.random() * 255);
    return mapFloat(value, 0, 255, -0.5, 0.5);
  }

  run(boids, speedMultiplier = 1.0) {
    this.flock(boids);
    this.update(speedMultiplier);
    this.wrapAroundBorders();
  }

  update(speedMultiplier = 1.0) {
    this.velocity.addSelf(this.acceleration);
    this.velocity.limit(this.maxspeed * speedMultiplier);
    this.location.addSelf(this.velocity);
    this.acceleration.multiplySelf(0);
  }

  applyForce(force) {
    this.acceleration.addSelf(force.divide(this.mass));
  }

  repelForce(obstacle, radius) {
    const futureLocation = this.location.add(this.velocity);
    const dir = futureLocation.subtract(obstacle);
    const distance = dir.mag();

    if (distance <= radius) {
      dir.normalize();
      dir.multiplySelf((this.maxspeed * (radius - distance)) / radius);
      const steer = dir.subtract(this.velocity);
      steer.limit(this.maxforce);
      this.applyForce(steer);
    }
  }

  flock(boids) {
    const sep = this.separate(boids);
    const ali = this.align(boids);
    const coh = this.cohesion(boids);

    sep.multiplySelf(BOIDS.SEPARATION_MULTIPLIER);
    ali.multiplySelf(BOIDS.ALIGNMENT_MULTIPLIER);
    coh.multiplySelf(BOIDS.COHESION_MULTIPLIER);

    this.applyForce(sep);
    this.applyForce(ali);
    this.applyForce(coh);
  }

  separate(boids) {
    const steer = new Vector2(0, 0);
    let count = 0;

    for (const boid of boids) {
      if (!boid.enabled) continue;
      const distance = this.location.dist(boid.location);
      if (distance > 0 && distance < this.desiredseparation) {
        const diff = this.location.subtract(boid.location);
        diff.normalize();
        diff.divideSelf(distance);
        steer.addSelf(diff);
        count += 1;
      }
    }

    if (count > 0) {
      steer.divideSelf(count);
    }

    if (steer.mag() > 0) {
      steer.normalize();
      steer.multiplySelf(this.maxspeed);
      steer.subtractSelf(this.velocity);
      steer.limit(this.maxforce);
    }

    return steer;
  }

  align(boids) {
    const sum = new Vector2(0, 0);
    let count = 0;

    for (const boid of boids) {
      if (!boid.enabled) continue;
      const distance = this.location.dist(boid.location);
      if (distance > 0 && distance < this.neighbordist) {
        sum.addSelf(boid.velocity);
        count += 1;
      }
    }

    if (count > 0) {
      sum.divideSelf(count);
      sum.normalize();
      sum.multiplySelf(this.maxspeed);
      const steer = sum.subtract(this.velocity);
      steer.limit(this.maxforce);
      return steer;
    }

    return new Vector2(0, 0);
  }

  cohesion(boids) {
    const sum = new Vector2(0, 0);
    let count = 0;

    for (const boid of boids) {
      if (!boid.enabled) continue;
      const distance = this.location.dist(boid.location);
      if (distance > 0 && distance < this.neighbordist) {
        sum.addSelf(boid.location);
        count += 1;
      }
    }

    if (count > 0) {
      sum.divideSelf(count);
      return this.seek(sum);
    }

    return new Vector2(0, 0);
  }

  seek(target) {
    const desired = target.subtract(this.location);
    desired.normalize();
    desired.multiplySelf(this.maxspeed);
    const steer = desired.subtract(this.velocity);
    steer.limit(this.maxforce);
    return steer;
  }

  arrive(target) {
    const desired = target.subtract(this.location);
    const distance = desired.mag();
    desired.normalize();
    if (distance < 100) {
      desired.multiplySelf(mapFloat(distance, 0, 100, 0, this.maxspeed));
    } else {
      desired.multiplySelf(this.maxspeed);
    }
    const steer = desired.subtract(this.velocity);
    steer.limit(this.maxforce);
    this.applyForce(steer);
  }

  wrapAroundBorders() {
    if (this.location.x < 0) this.location.x = this.limits.x - 1;
    if (this.location.y < 0) this.location.y = this.limits.y - 1;
    if (this.location.x >= this.limits.x) this.location.x = 0;
    if (this.location.y >= this.limits.y) this.location.y = 0;
  }

  avoidBorders() {
    const desired = new Vector2(this.velocity.x, this.velocity.y);

    if (this.location.x < 0) desired.x = this.maxspeed;
    if (this.location.x > this.limits.x) desired.x = -this.maxspeed;
    if (this.location.y < 0) desired.y = this.maxspeed;
    if (this.location.y > this.limits.y) desired.y = -this.maxspeed;

    if (desired.notEquals(this.velocity)) {
      const steer = desired.subtract(this.velocity);
      steer.limit(this.maxforce);
      this.applyForce(steer);
    }
  }

  bounceOffBorders(bounce) {
    let bounced = false;

    if (this.location.x < 0) {
      this.location.x = 0;
      this.velocity.x *= -bounce;
      bounced = true;
    } else if (this.location.x >= this.limits.x) {
      this.location.x = this.limits.x - 1;
      this.velocity.x *= -bounce;
      bounced = true;
    }

    if (this.location.y < 0) {
      this.location.y = 0;
      this.velocity.y *= -bounce;
      bounced = true;
    } else if (this.location.y >= this.limits.y) {
      this.location.y = this.limits.y - 1;
      this.velocity.y *= -bounce;
      bounced = true;
    }

    return bounced;
  }

  getDebugSnapshot() {
    return {
      location: this.location.toJSON(),
      velocity: this.velocity.toJSON(),
      maxspeed: this.maxspeed,
      maxforce: this.maxforce,
      enabled: this.enabled,
    };
  }
}

export default Boid;
