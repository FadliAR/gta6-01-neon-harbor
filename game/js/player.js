// NEON HARBOR — the player on foot: WASD run, jump, punch. Camera-relative.
import * as THREE from 'three';
import { CFG } from './config.js';
import { collideCircle, clampToCity } from './city.js';
import { makePerson } from './look.js';

export class Player {
  constructor(scene) {
    this.pos = new THREE.Vector3(14, 0, 24);
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.onGround = true;
    this.health = 100;
    this.punchCd = 0;
    this.punchAnim = 0;
    this.walkPhase = 0;
    // capsule rig with pivoted limbs (both arms now — the old figure had one)
    const rig = makePerson({ shirt: 0xff4d6d, pants: 0x1c2440, skin: 0xd9a066 });
    this.group = rig.group;
    this.body = rig.body;
    this.head = rig.head;
    this.legL = rig.legL;
    this.legR = rig.legR;
    this.armL = rig.armL;
    this.armR = rig.armR;
    this.group.position.copy(this.pos);
    scene.add(this.group);
  }

  reset(spawn) {
    this.pos.copy(spawn); this.pos.y = 0;
    this.vel.set(0, 0, 0); this.health = 100;
    this.group.position.copy(this.pos);
  }

  // input: {f,b,l,r,run,jump,punch}, camYaw, G helpers
  update(dt, input, camYaw, G) {
    this.punchCd = Math.max(0, this.punchCd - dt);
    this.punchAnim = Math.max(0, this.punchAnim - dt * 4);
    const speed = input.run ? CFG.runSpeed : CFG.walkSpeed;
    const f = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const move = new THREE.Vector3();
    if (input.f) move.add(f);
    if (input.b) move.sub(f);
    if (input.r) move.add(r);
    if (input.l) move.sub(r);
    const moving = move.lengthSq() > 0;
    if (moving) {
      move.normalize();
      this.pos.addScaledVector(move, speed * dt);
      const target = Math.atan2(move.x, move.z);
      let d = target - this.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.heading += d * Math.min(1, dt * 12);
      this.walkPhase += dt * speed * 1.6;
    }
    // jump + gravity
    if (input.jump && this.onGround) { this.vel.y = CFG.jumpSpeed; this.onGround = false; }
    this.vel.y -= CFG.gravity * dt;
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= 0) { this.pos.y = 0; this.vel.y = 0; this.onGround = true; }
    collideCircle(this.pos, 0.7, G.colliders);
    clampToCity(this.pos);
    if (input.punch && this.punchCd <= 0) {
      this.punchCd = 0.45; this.punchAnim = 1;
      G.effects.punch(this, G);
      G.audio.punch();
    }
    // animate (limbs are joint pivots now, so the swing pivots at hip/shoulder)
    const swing = moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.legL.rotation.x = swing; this.legR.rotation.x = -swing;
    this.armL.rotation.x = swing * 0.7;
    this.armR.rotation.x = this.punchAnim > 0 ? -1.9 * this.punchAnim : -swing * 0.7;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    this.group.position.y = this.pos.y + Math.abs(Math.sin(this.walkPhase)) * (moving ? 0.06 : 0);
  }

  hurt(amount) {
    this.health = Math.max(0, this.health - amount);
  }
}
