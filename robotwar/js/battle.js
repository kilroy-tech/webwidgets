import { RobotVM, createRandom } from "./vm.js";

export const BATTLE_CONFIG = Object.freeze({
  arenaSize: 256,
  robotRadius: 2.2,
  acceleration: 40,
  shellSpeed: 70,
  shellRadius: 1.5,
  blastRadius: 14,
  maxBlastDamage: 30,
  gunCooldown: 1.25,
  instructionsPerSecond: 100,
  inactivitySeconds: 60,
});

const COLORS = ["#f04f3d", "#33a8a5", "#f2b134", "#4d7ed8", "#c05bd8"];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angleVector = (angle) => {
  const radians = angle * Math.PI / 180;
  return { x: Math.sin(radians), y: -Math.cos(radians) };
};

export class Battle {
  constructor(definitions, options = {}) {
    this.config = { ...BATTLE_CONFIG, ...options.config };
    this.seed = Number(options.seed ?? 1) >>> 0;
    this.random = createRandom(this.seed);
    this.time = 0;
    this.inactiveTime = 0;
    this.shells = [];
    this.events = [];
    this.finished = false;
    this.result = null;
    const count = Math.min(5, definitions.length);
    this.spawns = options.spawns ? options.spawns.slice(0, count) : this.generateSpawns(count);
    this.robots = definitions.slice(0, 5).map((definition, index) => this.createRobot(definition, index));
  }

  generateSpawns(count) {
    const margin = 24;
    const minDistance = 32;
    const available = this.config.arenaSize - margin * 2;
    const spawns = [];

    for (let i = 0; i < count; i += 1) {
      let bestX = Math.round(margin + this.random() * available);
      let bestY = Math.round(margin + this.random() * available);
      let bestDist = -1;

      for (let attempt = 0; attempt < 200; attempt += 1) {
        const x = Math.round(margin + this.random() * available);
        const y = Math.round(margin + this.random() * available);
        const minDist = spawns.length === 0
          ? Infinity
          : Math.min(...spawns.map(([sx, sy]) => Math.hypot(x - sx, y - sy)));

        if (minDist >= minDistance) {
          bestX = x;
          bestY = y;
          bestDist = minDist;
          break;
        }

        if (minDist > bestDist) {
          bestDist = minDist;
          bestX = x;
          bestY = y;
        }
      }

      spawns.push([bestX, bestY]);
    }

    return spawns;
  }

  shuffledSpawns() {
    return this.generateSpawns(5);
  }

  createRobot(definition, index) {
    const [x, y] = this.spawns[index];
    const robot = {
      id: definition.id || `robot-${index + 1}`,
      name: definition.name || `ROBOT ${index + 1}`,
      color: definition.color || COLORS[index],
      source: definition.source || "",
      x, y, aim: 0, radarAngle: 0, radarResult: 0,
      requestedVx: 0, requestedVy: 0, vx: 0, vy: 0,
      damage: 100, cooldown: 0, alive: true, score: definition.score || 0,
      lastPc: 0, instructionCredit: 0,
    };
    robot.vm = new RobotVM(definition.instructions, {
      random: this.random,
      hardware: {
        read: (name) => this.readHardware(robot, name),
        write: (name, value) => this.writeHardware(robot, name, value),
      },
    });
    return robot;
  }

  readHardware(robot, name) {
    const values = {
      X: Math.round(robot.x), Y: Math.round(robot.y), AIM: robot.aim,
      RADAR: robot.radarResult, SHOT: robot.cooldown > 0 ? Math.ceil(robot.cooldown * 10) : 0,
      DAMAGE: Math.max(0, Math.ceil(robot.damage)),
      SPEEDX: Math.round(robot.requestedVx), SPEEDY: Math.round(robot.requestedVy),
    };
    return values[name] ?? 0;
  }

  writeHardware(robot, name, value) {
    if (!robot.alive) return;
    if (name === "AIM") robot.aim = ((value % 360) + 360) % 360;
    if (name === "SPEEDX") robot.requestedVx = clamp(value, -255, 255);
    if (name === "SPEEDY") robot.requestedVy = clamp(value, -255, 255);
    if (name === "RADAR") {
      robot.radarAngle = ((value % 360) + 360) % 360;
      robot.radarResult = this.castRadar(robot, robot.radarAngle);
      this.events.push({ type: "radar", robotId: robot.id, angle: robot.radarAngle, result: robot.radarResult, time: this.time });
    }
    if (name === "SHOT" && robot.cooldown <= 0) this.fire(robot, value);
  }

  castRadar(robot, angle) {
    const direction = angleVector(angle);
    const wallDistances = [];
    if (direction.x > 0) wallDistances.push((this.config.arenaSize - robot.x) / direction.x);
    if (direction.x < 0) wallDistances.push((0 - robot.x) / direction.x);
    if (direction.y > 0) wallDistances.push((this.config.arenaSize - robot.y) / direction.y);
    if (direction.y < 0) wallDistances.push((0 - robot.y) / direction.y);
    let nearest = Math.min(...wallDistances.filter((value) => value >= 0));
    let hitRobot = false;
    for (const other of this.robots) {
      if (!other.alive || other === robot) continue;
      const relativeX = other.x - robot.x;
      const relativeY = other.y - robot.y;
      const projection = relativeX * direction.x + relativeY * direction.y;
      if (projection <= 0) continue;
      const perpendicular = Math.abs(relativeX * direction.y - relativeY * direction.x);
      if (perpendicular <= this.config.robotRadius && projection < nearest) {
        nearest = projection;
        hitRobot = true;
      }
    }
    const result = clamp(Math.round(nearest), 0, 400);
    return hitRobot ? -result : result;
  }

  fire(robot, fuseDistance) {
    const direction = angleVector(robot.aim);
    this.shells.push({
      ownerId: robot.id, x: robot.x, y: robot.y,
      vx: direction.x * this.config.shellSpeed,
      vy: direction.y * this.config.shellSpeed,
      remaining: clamp(Math.abs(fuseDistance), 1, 400),
    });
    robot.cooldown = this.config.gunCooldown;
    this.events.push({ type: "shot", robotId: robot.id, angle: robot.aim, time: this.time });
  }

  approach(current, target, amount) {
    return current < target ? Math.min(target, current + amount) : Math.max(target, current - amount);
  }

  updateRobot(robot, seconds) {
    robot.instructionCredit += this.config.instructionsPerSecond * seconds;
    while (robot.alive && robot.instructionCredit >= 1 && !robot.vm.halted) {
      const trace = robot.vm.step();
      robot.lastPc = trace?.pc ?? robot.lastPc;
      robot.instructionCredit -= 1;
    }
    this.updateRobotPhysics(robot, seconds);
  }

  updateRobotPhysics(robot, seconds) {
    robot.cooldown = Math.max(0, robot.cooldown - seconds);
    const velocityChange = this.config.acceleration * seconds;
    robot.vx = this.approach(robot.vx, robot.requestedVx, velocityChange);
    robot.vy = this.approach(robot.vy, robot.requestedVy, velocityChange);
    robot.x += robot.vx * 0.1 * seconds;
    robot.y += robot.vy * 0.1 * seconds;
    const radius = this.config.robotRadius;
    const boundedX = clamp(robot.x, radius, this.config.arenaSize - radius);
    const boundedY = clamp(robot.y, radius, this.config.arenaSize - radius);
    if (boundedX !== robot.x || boundedY !== robot.y) {
      robot.x = boundedX;
      robot.y = boundedY;
      robot.vx *= -0.25;
      robot.vy *= -0.25;
      this.applyDamage(robot, 4, "wall");
    }
  }

  stepTestBench() {
    const robot = this.robots[0];
    if (!robot || !robot.alive || robot.vm.halted) return this.snapshot();
    const trace = robot.vm.step();
    robot.lastPc = trace?.pc ?? robot.lastPc;
    const seconds = 1 / this.config.instructionsPerSecond;
    this.time += seconds;
    this.inactiveTime += seconds;
    this.updateRobotPhysics(robot, seconds);
    this.updateShells(seconds);
    return this.snapshot();
  }

  resolveRobotCollisions() {
    for (let first = 0; first < this.robots.length; first += 1) {
      for (let second = first + 1; second < this.robots.length; second += 1) {
        const a = this.robots[first];
        const b = this.robots[second];
        if (!a.alive || !b.alive || distance(a, b) >= this.config.robotRadius * 2) continue;
        const impact = Math.min(25, Math.hypot(a.vx - b.vx, a.vy - b.vy) / 10);
        this.applyDamage(a, impact, "collision");
        this.applyDamage(b, impact, "collision");
        [a.vx, b.vx] = [b.vx * 0.3, a.vx * 0.3];
        [a.vy, b.vy] = [b.vy * 0.3, a.vy * 0.3];
      }
    }
  }

  updateShells(seconds) {
    const survivors = [];
    for (const shell of this.shells) {
      const travel = this.config.shellSpeed * seconds;
      shell.x += shell.vx * seconds;
      shell.y += shell.vy * seconds;
      shell.remaining -= travel;
      const hit = this.robots.find((robot) => robot.alive && robot.id !== shell.ownerId && distance(robot, shell) <= this.config.robotRadius + this.config.shellRadius);
      const outside = shell.x <= 0 || shell.y <= 0 || shell.x >= this.config.arenaSize || shell.y >= this.config.arenaSize;
      if (hit || outside || shell.remaining <= 0) this.explode(shell);
      else survivors.push(shell);
    }
    this.shells = survivors;
  }

  explode(shell) {
    let damaged = false;
    for (const robot of this.robots) {
      if (!robot.alive) continue;
      const proximity = distance(robot, shell);
      if (proximity > this.config.blastRadius) continue;
      const amount = this.config.maxBlastDamage * (1 - proximity / this.config.blastRadius);
      if (amount > 0.1) {
        this.applyDamage(robot, amount, "shell");
        damaged = true;
      }
    }
    if (damaged) this.inactiveTime = 0;
    this.events.push({ type: "explosion", x: shell.x, y: shell.y, time: this.time });
  }

  applyDamage(robot, amount, cause) {
    if (!robot.alive || amount <= 0) return;
    robot.damage = Math.max(0, robot.damage - amount);
    this.inactiveTime = 0;
    this.events.push({ type: "damage", robotId: robot.id, amount, cause, time: this.time });
    if (robot.damage <= 0) {
      robot.alive = false;
      robot.vm.halted = true;
      for (const survivor of this.robots) if (survivor.alive) survivor.score += 1;
      this.events.push({ type: "destroyed", robotId: robot.id, time: this.time });
    }
  }

  step(seconds = 0.02) {
    if (this.finished) return this.snapshot();
    const dt = clamp(seconds, 0, 0.1);
    this.time += dt;
    this.inactiveTime += dt;
    for (const robot of this.robots) if (robot.alive) this.updateRobot(robot, dt);
    this.resolveRobotCollisions();
    this.updateShells(dt);
    const living = this.robots.filter((robot) => robot.alive);
    if (living.length <= 1 || this.inactiveTime >= this.config.inactivitySeconds) {
      this.finished = true;
      this.result = living.length === 1 ? { type: "winner", winnerId: living[0].id } : { type: "draw" };
    }
    return this.snapshot();
  }

  snapshot() {
    return {
      seed: this.seed, time: this.time, finished: this.finished, result: this.result,
      robots: this.robots.map((robot) => ({
        id: robot.id, name: robot.name, color: robot.color, x: robot.x, y: robot.y,
        aim: robot.aim, radarAngle: robot.radarAngle, radarResult: robot.radarResult,
        damage: robot.damage, score: robot.score, alive: robot.alive, pc: robot.lastPc,
      })),
      shells: this.shells.map((shell) => ({ ...shell })),
    };
  }
}