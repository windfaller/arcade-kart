import * as THREE from "three";
import { makeBillboard, KART_ART } from "./art.js";

export const RACERS = [
  { name: "Volt", color: 0x2ee6a6, accent: 0x083830 },
  { name: "Ember", color: 0xff4d3d, accent: 0x3a0c0c },
  { name: "Reef", color: 0x3d8bff, accent: 0x0b2148 },
  { name: "Sunny", color: 0xffd23d, accent: 0x4a3808 },
  { name: "Orchid", color: 0xc45dff, accent: 0x2c0d48 },
  { name: "Bolt", color: 0xff8a2a, accent: 0x4a2208 },
];

const MAX_SPEED = 36;
const BOOST_SPEED = 54;
const ACCEL = 30;
const BRAKE = 46;
const REVERSE = 16;
const MAX_REVERSE = 11;
const DRAG = 6.5;
const TURN = 2.35;
const RIDE = 0.42;
const GRAVITY = -28;

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _tmp = new THREE.Vector3();

export function createKartMesh(color, accent, name) {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshBasicMaterial({ color });

  const sprite = makeBillboard(KART_ART[name] || KART_ART.Volt, 2.85, 1.9);
  sprite.position.y = 1.05;
  root.add(sprite);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  root.add(shadow);

  const wheels = [];
  for (let i = 0; i < 4; i++) {
    const holder = new THREE.Group();
    const spinner = new THREE.Group();
    holder.add(spinner);
    wheels.push({ holder, spinner });
  }

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 0.45),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, toneMapped: false })
  );
  glow.position.set(0, 0.22, -0.85);
  root.add(glow);

  root.userData.wheels = wheels;
  root.userData.glow = glow;
  root.userData.sprite = sprite;
  root.userData.bodyMat = bodyMat;
  return root;
}

export class Kart {
  constructor(racer, isPlayer) {
    this.racer = racer;
    this.isPlayer = isPlayer;
    this.mesh = createKartMesh(racer.color, racer.accent, racer.name);
    if (isPlayer) {
      const lamp = new THREE.PointLight(0xffe2b0, 2.4, 20, 1.7);
      lamp.position.set(0, 0.55, 1.4);
      this.mesh.add(lamp);
    }
    this.position = new THREE.Vector3();
    this.heading = 0;
    this.pitch = 0;
    this.roll = 0;
    this.speed = 0;
    this.steerAngle = 0;
    this.vy = 0;
    this.grounded = true;
    this.drifting = false;
    this.driftDir = 0;
    this.driftCharge = 0;
    this.boostTimer = 0;
    this.boostPower = 0;
    this.hopCooldown = 0;
    this.spinTimer = 0;
    this.invuln = 0;
    this.item = null;
    this.progress = 0;
    this.lap = 1;
    this.crossings = 0;
    this.nextCheckpoint = 0;
    this.finished = false;
    this.finishTime = 0;
    this.place = 1;
    this.lapTime = 0;
    this.bestLap = Infinity;
    this.currentLapClock = 0;
    this.offroad = false;
    this.engineRpm = 0;
    this.wheelSpin = 0;
    this.surfaceY = 0;
    this.surfacePitch = 0;
    this.surfaceRoll = 0;
    this._skid = 0;
    this.speedScale = 1;
  }

  placeOnTrack(track, progress, lateral) {
    const frame = track.frameAt(progress);
    this.progress = progress;
    this.heading = Math.atan2(frame.tangent.x, frame.tangent.z);
    this.position.copy(frame.position).addScaledVector(frame.right, lateral);
    this.position.y = frame.position.y + RIDE;
    this.speed = 0;
    this.mesh.position.copy(this.position);
    this.mesh.rotation.set(0, this.heading, 0);
  }

  resetRace() {
    this.speed = 0;
    this.steerAngle = 0;
    this.vy = 0;
    this.grounded = true;
    this.drifting = false;
    this.driftDir = 0;
    this.driftCharge = 0;
    this.boostTimer = 0;
    this.boostPower = 0;
    this.spinTimer = 0;
    this.invuln = 0;
    this.item = null;
    this.lap = 1;
    this.crossings = 0;
    this.nextCheckpoint = 0;
    this.finished = false;
    this.finishTime = 0;
    this.lapTime = 0;
    this.bestLap = Infinity;
    this.currentLapClock = 0;
    this.speedScale = 1;
  }

  raceScore() {
    if (this.finished) return 20 - this.finishTime * 0.0001;
    if (this.crossings === 0) return this.progress - 1;
    return (this.crossings - 1) + this.progress;
  }

  applyBoost(duration, power = 1) {
    this.boostTimer = Math.max(this.boostTimer, duration);
    this.boostPower = Math.max(this.boostPower, power);
  }

  hitSpin(intensity = 1) {
    if (this.invuln > 0) return;
    this.spinTimer = 0.85 * intensity;
    this.speed *= 0.28;
    this.drifting = false;
    this.driftCharge = 0;
    this.invuln = 1.1;
  }

  bump(dirX, dirZ, force) {
    this.position.x += dirX * force;
    this.position.z += dirZ * force;
    this.speed *= 0.72;
  }

  updateVisual(dt) {
    this.wheelSpin += this.speed * dt * 1.15;
    const wheels = this.mesh.userData.wheels;
    const steerVis = THREE.MathUtils.clamp(this.steerAngle, -0.55, 0.55);
    for (let i = 0; i < 4; i++) {
      wheels[i].spinner.rotation.x = this.wheelSpin;
      wheels[i].holder.rotation.y = i < 2 ? steerVis : 0;
    }
    const glow = this.mesh.userData.glow;
    glow.material.opacity = this.boostTimer > 0 ? 0.75 : this.drifting ? 0.28 : 0;
    glow.material.color.setHex(this.boostTimer > 0 ? 0x7dffd2 : 0xffc14a);

    const lean = THREE.MathUtils.clamp(
      -this.steerAngle * 0.22 - (this.drifting ? this.driftDir * 0.28 : 0),
      -0.4,
      0.4
    );
    this.mesh.position.copy(this.position);
    this.mesh.rotation.order = "YXZ";
    this.mesh.rotation.y = this.heading;
    this.mesh.rotation.x = this.pitch * 0.85;
    this.mesh.rotation.z = lean + this.roll * 0.5;
  }
}

export function simulateKart(kart, input, track, dt, canDrive) {
  if (kart.finished) {
    kart.speed += (0 - kart.speed) * Math.min(1, dt * 2.2);
    _integrate(kart, track, dt);
    kart.updateVisual(dt);
    return;
  }

  kart.hopCooldown = Math.max(0, kart.hopCooldown - dt);
  kart.invuln = Math.max(0, kart.invuln - dt);
  kart.currentLapClock += dt;

  if (kart.spinTimer > 0) {
    kart.spinTimer -= dt;
    kart.heading += dt * 9;
    kart.speed += (0 - kart.speed) * dt * 3;
    _integrate(kart, track, dt);
    kart.updateVisual(dt);
    return;
  }

  const steerIn = canDrive ? input.steer() : 0;
  const throttle = canDrive && input.accel ? 1 : 0;
  const brake = canDrive && input.brake ? 1 : 0;

  const targetSteer = steerIn;
  kart.steerAngle += (targetSteer - kart.steerAngle) * Math.min(1, dt * 10);

  if (canDrive && input.driftJustPressed && kart.grounded && kart.hopCooldown <= 0 && Math.abs(kart.speed) > 8) {
    kart.vy = 6.2;
    kart.grounded = false;
    kart.hopCooldown = 0.25;
    if (Math.abs(steerIn) > 0.2) {
      kart.driftDir = Math.sign(steerIn);
    }
  }

  if (kart.grounded && input.drift && Math.abs(kart.speed) > 12 && Math.abs(kart.steerAngle) > 0.25 && !kart.drifting) {
    kart.drifting = true;
    kart.driftDir = Math.sign(kart.steerAngle) || kart.driftDir || 1;
  }

  if (kart.drifting) {
    if (!input.drift || Math.abs(kart.speed) < 8) {
      if (kart.driftCharge > 1.25) kart.applyBoost(1.15, 1);
      else if (kart.driftCharge > 0.55) kart.applyBoost(0.65, 0.72);
      kart.drifting = false;
      kart.driftCharge = 0;
    } else {
      kart.driftCharge += dt;
      if (Math.abs(steerIn) > 0.2) kart.driftDir = Math.sign(steerIn) || kart.driftDir;
    }
  }

  const boost = kart.boostTimer > 0;
  if (boost) {
    kart.boostTimer -= dt;
    if (kart.boostTimer <= 0) kart.boostPower = 0;
  }

  const maxSpd = (boost ? BOOST_SPEED * (0.85 + 0.15 * kart.boostPower) : MAX_SPEED) * (kart.speedScale || 1);
  if (throttle) {
    kart.speed += ACCEL * dt * (boost ? 1.65 : 1);
  } else if (brake) {
    if (kart.speed > 0.4) kart.speed -= BRAKE * dt;
    else kart.speed -= REVERSE * dt;
  } else {
    kart.speed -= Math.sign(kart.speed) * DRAG * dt;
    if (Math.abs(kart.speed) < 0.15) kart.speed = 0;
  }

  if (kart.offroad && !boost) kart.speed *= 1 - dt * 1.8;

  const cap = kart.speed >= 0 ? maxSpd : MAX_REVERSE;
  if (kart.speed > cap) kart.speed += (cap - kart.speed) * Math.min(1, dt * 4);
  if (kart.speed < -MAX_REVERSE) kart.speed = -MAX_REVERSE;

  const speedK = Math.min(1, Math.abs(kart.speed) / MAX_SPEED);
  let turn = TURN * (1.15 - speedK * 0.55);
  if (kart.drifting) {
    turn *= 1.55;
    kart.heading += kart.driftDir * dt * 0.85;
    kart.speed *= 1 - dt * 0.12;
  }
  kart.heading += kart.steerAngle * turn * dt * Math.sign(kart.speed || 1) * (kart.speed === 0 ? 0 : 1);
  if (Math.abs(kart.speed) < 1.2) {
    kart.heading += kart.steerAngle * 1.1 * dt;
  }

  _integrate(kart, track, dt);
  kart.updateVisual(dt);
}

function _integrate(kart, track, dt) {
  _fwd.set(Math.sin(kart.heading), 0, Math.cos(kart.heading));
  _right.set(Math.cos(kart.heading), 0, -Math.sin(kart.heading));
  if (kart.drifting) {
    kart.position.addScaledVector(_right, kart.driftDir * Math.abs(kart.speed) * dt * 0.12);
  }
  kart.position.addScaledVector(_fwd, kart.speed * dt);

  const info = track.project(kart.position);
  kart.progress = info.progress;
  kart.surfaceY = info.position.y;
  kart.offroad = Math.abs(info.offset) > track.halfWidth - 0.15;

  const limit = track.halfWidth - 0.85;
  if (Math.abs(info.offset) > limit) {
    const extra = Math.abs(info.offset) - limit;
    const sign = Math.sign(info.offset);
    kart.position.addScaledVector(info.right, -sign * extra);
    const outward = _fwd.dot(info.right) * sign;
    if (outward > 0) kart.speed *= 0.55;
    kart.speed *= 0.92;
    kart.heading -= sign * extra * 0.08;
    kart._wallHit = extra;
  } else {
    kart._wallHit = 0;
  }

  const targetY = info.position.y + RIDE;
  if (!kart.grounded) {
    kart.vy += GRAVITY * dt;
    kart.position.y += kart.vy * dt;
    if (kart.position.y <= targetY) {
      kart.position.y = targetY;
      kart.vy = 0;
      kart.grounded = true;
      if (Math.abs(kart.steerAngle) > 0.2) {
        kart.drifting = true;
        kart.driftDir = Math.sign(kart.steerAngle);
      }
    }
  } else {
    kart.position.y += (targetY - kart.position.y) * Math.min(1, dt * 14);
  }

  kart.pitch += (Math.atan2(info.tangent.y, 1) * 0.9 - kart.pitch) * Math.min(1, dt * 8);
  kart.roll += (-info.offset / track.halfWidth * 0.08 - kart.roll) * Math.min(1, dt * 6);
}
