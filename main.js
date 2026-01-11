import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.158/examples/jsm/controls/OrbitControls.js";
import { BufferGeometryUtils } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/utils/BufferGeometryUtils.js';

// =====================
// SCENE SETUP
// =====================
const scene = new THREE.Scene();

const earthTexture = new THREE.TextureLoader().load(
  "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
  () => console.log("Earth texture loaded"),
  undefined,
  (err) => console.error("Texture load error:", err)
);

earthTexture.colorSpace = THREE.SRGBColorSpace;


scene.background = new THREE.Color(0x000000);

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

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
  map: earthTexture
});
earthGeometry.rotateX(Math.PI / 2);
const earth = new THREE.Mesh(earthGeometry, earthMaterial);

const earthAxes = new THREE.AxesHelper(2_000_000);
earth.add(earthAxes);
scene.add(earth);
scene.add

// =====================
// LAUNCHER
// =====================
const ROCKET_RADIUS = 10_000;
const ROCKET_HEIGHT = 50_000;
const CONE_HEIGHT = 10_000;
const rocketGeo = new THREE.CylinderGeometry(ROCKET_RADIUS, ROCKET_RADIUS, ROCKET_HEIGHT, 16);
const coneGeo = new THREE.ConeGeometry(ROCKET_RADIUS, CONE_HEIGHT, 16);
// Translate cone geometry so its base sits exactly on the cylinder top
const rocketGeoTranslated = rocketGeo.clone();
rocketGeoTranslated.applyMatrix4(new THREE.Matrix4().makeTranslation(0, ROCKET_HEIGHT/2, 0));

const coneGeoTranslated = coneGeo.clone();
const translateY = ROCKET_HEIGHT + CONE_HEIGHT / 2 + 0.01; // small epsilon to avoid z-fighting
coneGeoTranslated.applyMatrix4(new THREE.Matrix4().makeTranslation(0, translateY, 0));

// 🔧 ROTATE GEOMETRY so thrust axis = +Z
rocketGeoTranslated.rotateX(Math.PI / 2);
coneGeoTranslated.rotateX(Math.PI / 2);

// Merge geometries
const merged = BufferGeometryUtils.mergeBufferGeometries([rocketGeoTranslated, coneGeoTranslated], true);
merged.computeVertexNormals();

const launcherMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6 });
const launcher = new THREE.Mesh(merged, launcherMaterial);
const launcherAxes = new THREE.AxesHelper(300_000);
launcher.add(launcherAxes);
scene.add(launcher);

// Align cone forward
//launcher.rotation.x = Math.PI / 2;

// Kourou
const KOUROU = {
  lat: 5.236,
  lon: -52.768,
  alt: 0
};

const START_ECEF = llhToECEF(KOUROU.lat, KOUROU.lon, 0);
launcher.position.copy (START_ECEF);

const { east, north, up } = computeENUFrame(
  KOUROU.lat,
  KOUROU.lon
);

// Build rotation matrix: columns = basis vectors
const enuMatrix = new THREE.Matrix4().makeBasis(
  east,
  north,
  up
);

const enuQuaternion = new THREE.Quaternion()
  .setFromRotationMatrix(enuMatrix);

// Initial orientation (straight up)
launcher.quaternion.copy(enuQuaternion);

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
function applyOrientationENU(obj, yawDeg, pitchDeg, rollDeg, enuQuat) {
  const yaw = THREE.MathUtils.degToRad(yawDeg);
  const pitch = THREE.MathUtils.degToRad(pitchDeg);
  const roll = THREE.MathUtils.degToRad(rollDeg);

  // Local ENU rotation
  const localQuat = new THREE.Quaternion()
    .setFromEuler(new THREE.Euler(pitch, roll, yaw, "XZY"));
    // X = pitch (Up/East plane)
    // Z = yaw (around Up)

  // Compose: ECEF ← ENU ← local
  obj.quaternion.copy(enuQuat).multiply(localQuat);
}


const MIN_SEGMENT_LENGTH = 5; // meters

// =====================
// TRAJECTORY SEGMENTS
// =====================
let previousPosition = null;

function addTrajectorySegment(p0, p1) {
  const geometry = new THREE.BufferGeometry().setFromPoints([p0, p1]);

  const material = new THREE.LineBasicMaterial({
    color: 0xffff00
  });

  const segment = new THREE.Line(geometry, material);
  scene.add(segment);
}


function computeENUFrame(latDeg, lonDeg) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);

  // East
  const east = new THREE.Vector3(
    -Math.sin(lon),
     Math.cos(lon),
     0
  ).normalize();

  // North
  const north = new THREE.Vector3(
    -Math.sin(lat) * Math.cos(lon),
    -Math.sin(lat) * Math.sin(lon),
     Math.cos(lat)
  ).normalize();

  // Up
  const up = new THREE.Vector3(
     Math.cos(lat) * Math.cos(lon),
     Math.cos(lat) * Math.sin(lon),
     Math.sin(lat)
  ).normalize();

  return { east, north, up };
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

    const launcherECEF = llhToECEF(lat, lon, alt);
    launcher.position.copy(launcherECEF);
    applyOrientationENU(
      launcher,
      yaw,
      pitch,
      roll,
      enuQuaternion
    );


    // =====================
    // TRAJECTORY UPDATE
    // =====================
    if (previousPosition) {
      const distance = launcherECEF.distanceTo(previousPosition);

      if (distance >= MIN_SEGMENT_LENGTH) {
        addTrajectorySegment(
          previousPosition.clone(),
          launcherECEF.clone()
        );

        previousPosition.copy(launcherECEF);
      }
    } else {
      previousPosition = launcherECEF.clone();
    }

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
