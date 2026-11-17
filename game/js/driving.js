// NEON HARBOR — arcade driving: enter/exit, steal, accel/brake/steer, collisions.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeCarMesh } from './vehicles.js';
import { collideCircle, clampToCity } from './city.js';

export class Driving {
  constructor(scene) {
    this.inCar = false;
    this.car = null; // {mesh,pos,angle,speed,parked?}
    this.scene = scene;
    this.steerVis = 0;
  }

  // nearest parked car within 3.5 m of the player
  nearestParked(playerPos, parked) {
    let best = null, bd = 3.5;
    for (const p of parked) {
      if (p.taken) continue;
      const d = p.pos.distanceTo(playerPos);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  enter(parkedCar, G) {
    parkedCar.taken = true;
    parkedCar.mesh.visible = false;
    const mesh = makeCarMesh(parkedCar.color);
    mesh.position.copy(parkedCar.pos);
    mesh.rotation.y = parkedCar.angle;
    this.scene.add(mesh);
    this.car = { mesh, pos: parkedCar.pos.clone(), angle: parkedCar.angle, speed: 0, color: parkedCar.color };
    this.inCar = true;
    return this.car;
  }

  exit(G) {
    if (!this.car) return;
    const side = new THREE.Vector3(Math.cos(this.car.angle), 0, -Math.sin(this.car.angle));
    const out = this.car.pos.clone().addScaledVector(side, 3);
    G.player.pos.copy(out); G.player.pos.y = 0;
    G.player.group.position.copy(out);
    // re-park the car so it can be stolen again (round-1 bug fix: exit left it un-enterable)
    const parked = { mesh: this.car.mesh, pos: this.car.pos.clone(), angle: this.car.angle, taken: false, color: this.car.color };
    parked.mesh.visible = true;
    G.parked.push(parked);
    this.car = null;
    this.inCar = false;
  }

  update(dt, input, G) {
    if (!this.inCar || !this.car) return;
    const c = this.car;
    if (input.f) c.speed += CFG.carAccel * dt;
    if (input.b) c.speed -= (c.speed > 0.5 ? CFG.carBrake : CFG.carAccel * 0.6) * dt;
    if (!input.f && !input.b) c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 8 * dt);
    c.speed = THREE.MathUtils.clamp(c.speed, -CFG.carReverseMax, CFG.carMaxSpeed);
    const steerTarget = (input.l ? 1 : 0) - (input.r ? 1 : 0);
    this.steerVis += (steerTarget - this.steerVis) * Math.min(1, dt * 8);
    const dir = c.speed >= 0 ? 1 : -1;
    c.angle += this.steerVis * CFG.carSteer * dir * Math.min(1, Math.abs(c.speed) / 8) * dt;
    const nx = c.pos.x + Math.sin(c.angle) * c.speed * dt;
    const nz = c.pos.z + Math.cos(c.angle) * c.speed * dt;
    const prev = c.pos.clone();
    c.pos.set(nx, 0, nz);
    if (collideCircle(c.pos, 2.2, G.colliders)) {
      // hit a building: scrape speed, keep position pushed out (0.5 s cooldown)
      c.speed *= -0.25;
      if (G.time - (G.lastCrashT || -99) > 0.5) {
        G.lastCrashT = G.time;
        G.effects.crash(c.pos, G);
        G.audio.crash();
        G.player.hurt(4);
      }
    }
    clampToCity(c.pos);
    // bump traffic cars
    for (const t of G.traffic) {
      const d = t.pos.distanceTo(c.pos);
      if (d < 4.5 && d > 0.01) {
        const push = (4.5 - d) / 2;
        const px = (c.pos.x - t.pos.x) / d, pz = (c.pos.z - t.pos.z) / d;
        c.pos.x += px * push; c.pos.z += pz * push;
        t.pos.x -= px * push; t.pos.z -= pz * push;
        c.speed *= 0.6;
      }
    }
    void prev;
    c.mesh.position.copy(c.pos);
    c.mesh.rotation.y = c.angle;
    for (const w of c.mesh.userData.wheels) w.rotation.x += c.speed * dt * 1.4;
    // keep the player glued to the car
    G.player.pos.copy(c.pos);
    G.player.group.position.copy(c.pos);
    G.player.group.rotation.y = c.angle;
    G.speedKmh = Math.abs(c.speed) * 3.6;
  }
}
