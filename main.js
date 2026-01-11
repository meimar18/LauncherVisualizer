import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.158/examples/jsm/controls/OrbitControls.js";
import { BufferGeometryUtils } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/utils/BufferGeometryUtils.js';

// =====================
// SCENE SETUP
// =====================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  1,
  1e9
);
camera.position.set(0, -8_000_000, 4_000_000);

// =====================
// RENDERER
// =====================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// =====================
// ORBIT CONTROLS
// =====================
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);          // Earth center
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 7_000_000;
controls.maxDistance = 50_000_000;
controls.update();

// =====================
// LIGHTS
// =====================
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(1, 1, 1);
scene.add(dirLight);

// =====================
// EARTH
// =====================
const EARTH_RADIUS = 6_371_000;

const earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
const earthMaterial = new THREE.MeshPhongMaterial({
  color: 0x2233ff,
  wireframe: true,
  transparent: true,
  opacity: 0.3
});
const earth = new THREE.Mesh(earthGeometry, earthMaterial);
scene.add(earth);

// =====================
// LAUNCHER
// =====================
const ROCKET_RADIUS = 50_000;
const ROCKET_HEIGHT = 250_000;
const CONE_HEIGHT = 50_000;
const rocketGeo = new THREE.CylinderGeometry(ROCKET_RADIUS, ROCKET_RADIUS, ROCKET_HEIGHT, 16);
const coneGeo = new THREE.ConeGeometry(ROCKET_RADIUS, CONE_HEIGHT, 16);
// Translate cone geometry so its base sits exactly on the cylinder top
const coneGeoTranslated = coneGeo.clone();
const translateY = ROCKET_HEIGHT / 2 + CONE_HEIGHT / 2 + 0.01; // small epsilon to avoid z-fighting
coneGeoTranslated.applyMatrix4(new THREE.Matrix4().makeTranslation(0, translateY, 0));

// Merge geometries
const merged = BufferGeometryUtils.mergeBufferGeometries([rocketGeo, coneGeoTranslated], true);
merged.computeVertexNormals();

const launcherMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6 });
const launcher = new THREE.Mesh(merged, launcherMaterial);
scene.add(launcher);

// Align cone forward
launcher.rotation.x = Math.PI / 2;

// =====================
// LLH → ECEF
// =====================
function llhToECEF(latDeg, lonDeg, alt) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const r = EARTH_RADIUS + alt;

  return new THREE.Vector3(
    r * Math.cos(lat) * Math.cos(lon),
    r * Math.cos(lat) * Math.sin(lon),
    r * Math.sin(lat)
  );
}

// =====================
// ORIENTATION
// =====================
function applyOrientation(obj, yaw, pitch, roll) {
  obj.rotation.order = "ZYX";
  obj.rotation.z = THREE.MathUtils.degToRad(yaw);
  obj.rotation.x = THREE.MathUtils.degToRad(pitch);
  obj.rotation.y = THREE.MathUtils.degToRad(roll);
}

// =====================
// WEBSOCKET
// =====================
const socket = new WebSocket("ws://localhost:8081");

socket.onopen = () => console.log("WebSocket connected");

socket.onmessage = (event) => {
  console.log("WS RAW:", event.data);
  try {
    const data = JSON.parse(event.data);

    const { lat, lon, alt } = data.position;
    const { yaw, pitch, roll } = data.orientation;

    launcher.position.copy(llhToECEF(lat, lon, alt));
    applyOrientation(launcher, yaw, pitch, roll);

  } catch (e) {
    console.error("Invalid message", e);
  }
};

// =====================
// ANIMATION LOOP
// =====================
function animate() {
  requestAnimationFrame(animate);
  controls.update();       // REQUIRED for damping
  renderer.render(scene, camera);
}

animate();

// =====================
// RESIZE
// =====================
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
