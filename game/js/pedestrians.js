// NEON HARBOR — pedestrians: walk / idle / flee finite-state machine.
import * as THREE from 'three';
import { CFG } from './config.js';
import { collideCircle } from './city.js';
import { makePerson } from './look.js';

const SHIRTS = [0x39c6ff, 0xffd23f, 0x8a5cf6, 0x22b573, 0xff7a1a, 0xe8e8e8, 0xff8ab0];

export class Pedestrians {
  constructor(scene, rng, streets) {
    this.rng = rng;
    this.streets = streets;
    this.list = [];
    for (let i = 0; i < CFG.pedCount; i++) {
      const rig = makePerson({ shirt: rng.pick(SHIRTS), pants: 0x1c2440, skin: 0xc98a5a });
      const g = rig.group;
      const pos = this.randomSidewalkSpot();
      g.position.copy(pos);
      scene.add(g);
      this.list.push({
        group: g, legL: rig.legL, legR: rig.legR, armL: rig.armL, armR: rig.armR, pos, heading: rng.range(0, Math.PI * 2),
        state: 'walk', target: this.randomSidewalkSpot(), speed: rng.range(1.2, 2.2),
        idleT: 0, phase: rng.range(0, 6), hp: 100, fleeT: 0,
      });
    }
  }

  randomSidewalkSpot() {
    const s = this.rng.pick(this.streets);
    const along = this.rng.range(-190, 190);
    return this.rng.chance(0.5)
      ? new THREE.Vector3(s + 8.5, 0, along)
      : new THREE.Vector3(along, 0, s + 8.5);
  }

  // scare peds near a point (punch / crash): they flee
  scare(pos, radius) {
    for (const p of this.list) {
      if (p.pos.distanceTo(pos) < radius) {
        p.state = 'flee'; p.fleeT = 2.5;
        p.target = p.pos.clone().add(p.pos.clone().sub(pos).setY(0).normalize().multiplyScalar(40));
      }
    }
  }

  update(dt, G) {
    for (const p of this.list) {
      if (p.hp <= 0) { p.group.visible = false; continue; }
      let speed = 0;
      if (p.state === 'idle') {
        p.idleT -= dt;
        if (p.idleT <= 0) { p.state = 'walk'; p.target = this.randomSidewalkSpot(); }
      } else {
        const to = p.target.clone().sub(p.pos); to.y = 0;
        const dist = to.length();
        if (dist < 1.5) {
          if (p.state === 'flee') { p.state = 'walk'; p.target = this.randomSidewalkSpot(); }
          else { p.state = 'idle'; p.idleT = this.rng.range(1, 4); }
        } else {
          to.normalize();
          const want = Math.atan2(to.x, to.z);
          let d = want - p.heading;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          p.heading += d * Math.min(1, dt * 6);
          speed = p.state === 'flee' ? 5 : p.speed;
          p.pos.addScaledVector(to, speed * dt);
          p.phase += dt * speed * 2.4;
        }
      }
      collideCircle(p.pos, 0.6, G.colliders);
      p.pos.x = THREE.MathUtils.clamp(p.pos.x, -198, 198);
      p.pos.z = THREE.MathUtils.clamp(p.pos.z, -198, CFG.waterZ - 4);
      p.group.position.copy(p.pos);
      p.group.rotation.y = p.heading;
      const swing = speed > 0 ? Math.sin(p.phase) * 0.5 : 0;
      p.legL.rotation.x = swing; p.legR.rotation.x = -swing;
      p.armL.rotation.x = swing * 0.7; p.armR.rotation.x = -swing * 0.7;
    }
  }
}
