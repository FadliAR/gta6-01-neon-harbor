// NEON HARBOR — third-person follow camera with trauma shake.
import * as THREE from 'three';
import { CFG } from './config.js';

export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.trauma = 0;
    this.smoothPos = new THREE.Vector3(14, 8, 40);
  }

  addTrauma(n) { this.trauma = Math.min(1, this.trauma + n); }

  update(dt, targetPos, targetHeading, inCar, speedKmh) {
    // yaw follows behind the target heading
    const wantYaw = targetHeading + Math.PI;
    let d = wantYaw - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, dt * 3.5);
    const dist = inCar ? CFG.camDistCar : CFG.camDist;
    const height = inCar ? CFG.camHeightCar : CFG.camHeight;
    const back = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const desired = targetPos.clone()
      .addScaledVector(back, dist)
      .add(new THREE.Vector3(0, height, 0));
    this.smoothPos.lerp(desired, Math.min(1, dt * 6));
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    const sh = this.trauma * this.trauma;
    const off = new THREE.Vector3(
      (Math.random() - 0.5) * sh * 1.6,
      (Math.random() - 0.5) * sh * 1.2,
      (Math.random() - 0.5) * sh * 1.6
    );
    this.camera.position.copy(this.smoothPos).add(off);
    const look = targetPos.clone().add(new THREE.Vector3(0, 2, 0));
    this.camera.lookAt(look);
  }

  // wide establishing shot (screenshots / title backdrop)
  wideShot(targetPos) {
    this.camera.position.set(targetPos.x + 60, 55, targetPos.z + 90);
    this.camera.lookAt(targetPos.x, 10, targetPos.z);
  }
}
