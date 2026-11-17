// NEON HARBOR — tuning constants. One place for every magic number.
export const CFG = {
  seed: 1337,
  // city layout (metres)
  pitch: 56,            // street-to-street distance
  roadHalf: 6,          // half road width
  blocks: 3,            // streets at -3..3 * pitch
  groundSize: 460,
  waterZ: 205,          // water starts south of this z
  spireHeight: 78,
  // player on foot
  walkSpeed: 6,
  runSpeed: 10,
  jumpSpeed: 8.5,
  gravity: 24,
  punchRange: 2.2,
  punchDamage: 34,
  // driving
  carAccel: 26,
  carBrake: 40,
  carMaxSpeed: 34,      // ~122 km/h
  carReverseMax: 10,
  carSteer: 1.9,
  carGrip: 6,
  // wanted
  heatPerStar: 25,
  heatStealCar: 26,
  heatPunch: 12,
  heatDecay: 1.6,       // heat points per second while calm
  bustedDist: 1.7,
  bustedTime: 0.8,
  // missions
  missionTime: 150,     // seconds for the whole 3-job chain
  missionPay: [200, 300, 450],
  coinValue: 25,
  coinCount: 10,
  // traffic + peds
  trafficCount: 14,
  pedCount: 24,
  // camera
  camDist: 9,
  camHeight: 4.2,
  camDistCar: 12,
  camHeightCar: 5,
};
