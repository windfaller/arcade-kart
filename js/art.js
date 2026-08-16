import * as THREE from "three";
import volt from "./art-volt.js";
import ember from "./art-ember.js";
import reef from "./art-reef.js";
import sunny from "./art-sunny.js";
import orchid from "./art-orchid.js";
import bolt from "./art-bolt.js";
import palm from "./art-palm.js";
import rock from "./art-rock.js";
import cloud from "./art-cloud.js";

const loader = new THREE.TextureLoader();

export const KART_ART = {
  Volt: volt,
  Ember: ember,
  Reef: reef,
  Sunny: sunny,
  Orchid: orchid,
  Bolt: bolt,
};

export const PROP_ART = {
  palm,
  rock,
  cloud,
};

const cache = new Map();

export function loadArt(url) {
  if (cache.has(url)) return cache.get(url);
  const tex = loader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(url, tex);
  return tex;
}

export function makeBillboard(url, width, height) {
  const mat = new THREE.MeshBasicMaterial({
    map: loadArt(url),
    transparent: true,
    alphaTest: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.userData.billboard = true;
  mesh.castShadow = false;
  return mesh;
}
