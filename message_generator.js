const dgram = require('dgram');

const client = dgram.createSocket('udp4');
const PORT = 41234;
const HOST = 'localhost';

const DURATION = 600;              // segundos
const RATE = 25;                   // Hz
const TOTAL_STEPS = DURATION * RATE;
const DT = 1 / RATE;

const MAX_ALT = 220000;             // metros

// Kourou
const START = {
  lat: 5.236,
  lon: -52.768,
  alt: 0
};

// Madrid
const END = {
  lat: 40.4168,
  lon: -3.7038,
  alt: 0
};

// ===================== UTILIDADES =====================
const deg2rad = d => d * Math.PI / 180;
const rad2deg = r => r * 180 / Math.PI;

// Interpolación por gran círculo
function interpolateGreatCircle(p0, p1, f) {
  const lat1 = deg2rad(p0.lat);
  const lon1 = deg2rad(p0.lon);
  const lat2 = deg2rad(p1.lat);
  const lon2 = deg2rad(p1.lon);

  const d = Math.acos(
    Math.sin(lat1) * Math.sin(lat2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)
  );

  if (d === 0) return { ...p0 };

  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);

  const x =
    A * Math.cos(lat1) * Math.cos(lon1) +
    B * Math.cos(lat2) * Math.cos(lon2);
  const y =
    A * Math.cos(lat1) * Math.sin(lon1) +
    B * Math.cos(lat2) * Math.sin(lon2);
  const z =
    A * Math.sin(lat1) +
    B * Math.sin(lat2);

  return {
    lat: rad2deg(Math.atan2(z, Math.sqrt(x * x + y * y))),
    lon: rad2deg(Math.atan2(y, x))
  };
}

// Altura parabólica
function parabolaHeight(f) {
  return 4 * MAX_ALT * f * (1 - f);
}

// Cálculo de orientación tangente
function computeOrientation(p, pNext, alt, altNext) {
  const R = 6371000;

  const dLat = deg2rad(pNext.lat - p.lat);
  const dLon = deg2rad(pNext.lon - p.lon);
  const lat = deg2rad(p.lat);

  const dNorth = dLat * R;
  const dEast = dLon * R * Math.cos(lat);
  const dUp = altNext - alt;

  const yaw = rad2deg(Math.atan2(dEast, dNorth));
  const pitch = rad2deg(Math.atan2(dUp, Math.sqrt(dNorth**2 + dEast**2)));

  return {
    yaw,
    pitch,
    roll: 0
  };
}

// ===================== EMISIÓN =====================
let step = 0;

function generateData() {
  if (step >= TOTAL_STEPS) {
    clearInterval(interval);
    socket.close();
    console.log("Transmisión finalizada");
    return;
  }

  const f = step / (TOTAL_STEPS - 1);
  const fNext = Math.min(1, (step + 1) / (TOTAL_STEPS - 1));

  const pos = interpolateGreatCircle(START, END, f);
  const posNext = interpolateGreatCircle(START, END, fNext);

  const alt = parabolaHeight(f);
  const altNext = parabolaHeight(fNext);

  const orientation = computeOrientation(pos, posNext, alt, altNext);

  const message = {
    time: step * DT,
    position: {
      lat: pos.lat,
      lon: pos.lon,
      alt: alt
    },
    orientation: {
      yaw: orientation.yaw,
      pitch: orientation.pitch,
      roll: orientation.roll
    }
  };
  step++;
  return message;
}

function sendMessage() {
    const message = JSON.stringify(generateData());
    client.send(message, PORT, HOST, (err) => {
        if (err) {
            console.error('Error sending message:', err);
        } else {
            console.log('Message sent:', message);
        }
    });
}

setInterval(sendMessage, 1000/RATE); // Send a message every second