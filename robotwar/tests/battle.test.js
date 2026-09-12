import test from "node:test";
import assert from "node:assert/strict";
import { compile } from "../js/compiler.js";
import { Battle } from "../js/battle.js";

function definition(name, source) {
  const result = compile(source);
  assert.deepEqual(result.diagnostics, []);
  return { name, instructions: result.instructions };
}

test("radar returns a negative distance for a robot before a wall", () => {
  const idle = definition("IDLE", "0 TO SPEEDX");
  const battle = new Battle([idle, idle]);
  const scanner = battle.robots[0];
  const target = battle.robots[1];
  scanner.x = 50; scanner.y = 100;
  target.x = 150; target.y = 100;
  assert.equal(battle.castRadar(scanner, 90), -100);
  assert.equal(battle.castRadar(scanner, 270), 50);
});

test("a fused shell damages a target and awards survivors on destruction", () => {
  const idle = definition("IDLE", "0 TO SPEEDX");
  const battle = new Battle([idle, idle]);
  const shooter = battle.robots[0];
  const target = battle.robots[1];
  shooter.x = 50; shooter.y = 100; shooter.aim = 90;
  target.x = 70; target.y = 100; target.damage = 5;
  battle.fire(shooter, 20);
  for (let count = 0; count < 100 && target.alive; count += 1) battle.step(0.02);
  assert.equal(target.alive, false);
  assert.equal(shooter.score, 1);
  assert.deepEqual(battle.result, { type: "winner", winnerId: shooter.id });
});

test("fixed seed and timestep produce the same snapshot", () => {
  const mover = definition("MOVER", "100 TO RANDOM\nRANDOM TO SPEEDX\nLOOP\nGOTO LOOP");
  const first = new Battle([mover, mover], { seed: 77 });
  const second = new Battle([mover, mover], { seed: 77 });
  for (let count = 0; count < 50; count += 1) {
    first.step(0.02);
    second.step(0.02);
  }
  assert.deepEqual(first.snapshot(), second.snapshot());
});

test("battle seed controls spawn assignment", () => {
  const idle = definition("IDLE", "0 TO SPEEDX");
  const definitions = [idle, idle, idle, idle, idle];
  const first = new Battle(definitions, { seed: 11 });
  const replay = new Battle(definitions, { seed: 11 });
  const different = new Battle(definitions, { seed: 12 });
  const positions = (battle) => battle.robots.map(({ x, y }) => [x, y]);
  assert.deepEqual(positions(first), positions(replay));
  assert.notDeepEqual(positions(first), positions(different));
});

test("spawns are randomized within arena bounds and separated", () => {
  const idle = definition("IDLE", "0 TO SPEEDX");
  const battle = new Battle([idle, idle, idle, idle, idle], { seed: 999 });
  for (const robot of battle.robots) {
    assert.ok(robot.x >= 24 && robot.x <= 232);
    assert.ok(robot.y >= 24 && robot.y <= 232);
  }
  for (let i = 0; i < battle.robots.length; i += 1) {
    for (let j = i + 1; j < battle.robots.length; j += 1) {
      const dist = Math.hypot(battle.robots[i].x - battle.robots[j].x, battle.robots[i].y - battle.robots[j].y);
      assert.ok(dist >= 32);
    }
  }
});

test("test bench instruction steps update position through battle physics", () => {
  const mover = definition("MOVER", "100 TO SPEEDX\nLOOP\nGOTO LOOP");
  const battle = new Battle([mover], { seed: 1, spawns: [[128, 128]] });
  for (let count = 0; count < 120; count += 1) battle.stepTestBench();
  assert.ok(battle.readHardware(battle.robots[0], "X") > 128);
  assert.equal(battle.finished, false);
});

test("test bench applies wall collision damage", () => {
  const mover = definition("MOVER", "255 TO SPEEDX\nLOOP\nGOTO LOOP");
  const battle = new Battle([mover], { seed: 1, spawns: [[250, 128]] });
  for (let count = 0; count < 500; count += 1) battle.stepTestBench();
  assert.ok(battle.readHardware(battle.robots[0], "DAMAGE") < 100);
  assert.ok(battle.readHardware(battle.robots[0], "X") <= 254);
});