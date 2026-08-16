import * as THREE from "three";

const loader = new THREE.TextureLoader();

export const KART_ART = {
  Volt: "assets/kart-volt.png",
  Ember: "assets/kart-ember.png",
  Reef: "assets/kart-reef.png",
  Sunny: "assets/kart-sunny.png",
  Orchid: "assets/kart-orchid.png",
  Bolt: "assets/kart-bolt.png",
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
