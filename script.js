const canvas = document.getElementById('viewport');
const ctx = canvas.getContext('2d');

let width, height, imgData, zbuffer;

function resize() {
  const rect = canvas.getBoundingClientRect();
  width = canvas.width = Math.floor(rect.width);
  height = canvas.height = Math.floor(rect.height);
  imgData = ctx.createImageData(width, height);
  zbuffer = new Float32Array(width * height);
}
window.addEventListener('resize', resize);

// --- vector helpers, nothing fancy ---
function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function length(a) { return Math.sqrt(dot(a, a)); }
function normalize(a) {
  const l = length(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}

// --- 4x4 matrix stuff, row major, flat arrays of 16 ---
function multiplyMat4(a, b) {
  const out = new Array(16).fill(0);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[r * 4 + k] * b[k * 4 + c];
      out[r * 4 + c] = sum;
    }
  }
  return out;
}

function transformPoint(m, p) {
  const x = p.x, y = p.y, z = p.z;
  return {
    x: m[0] * x + m[1] * y + m[2] * z + m[3],
    y: m[4] * x + m[5] * y + m[6] * z + m[7],
    z: m[8] * x + m[9] * y + m[10] * z + m[11],
    w: m[12] * x + m[13] * y + m[14] * z + m[15]
  };
}

function rotationX(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [1,0,0,0, 0,c,-s,0, 0,s,c,0, 0,0,0,1];
}
function rotationY(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c,0,s,0, 0,1,0,0, -s,0,c,0, 0,0,0,1];
}
function translation(x, y, z) {
  return [1,0,0,x, 0,1,0,y, 0,0,1,z, 0,0,0,1];
}
const IDENTITY = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];

// --- meshes ---
function makeMesh(vertices, faces, color) {
  const mesh = { vertices, faces, color };
  fixWinding(mesh);
  return mesh;
}

// makes sure every triangle's normal points away from the object center,
// so we don't have to hand-pick winding order per face
function fixWinding(mesh) {
  for (const f of mesh.faces) {
    const v0 = mesh.vertices[f[0]];
    const v1 = mesh.vertices[f[1]];
    const v2 = mesh.vertices[f[2]];
    const n = cross(sub(v1, v0), sub(v2, v0));
    const centroid = {
      x: (v0.x + v1.x + v2.x) / 3,
      y: (v0.y + v1.y + v2.y) / 3,
      z: (v0.z + v1.z + v2.z) / 3
    };
    if (dot(n, centroid) < 0) {
      const tmp = f[1];
      f[1] = f[2];
      f[2] = tmp;
    }
  }
}

function buildCube() {
  const v = [
    { x: -1, y: -1, z: -1 }, { x: 1, y: -1, z: -1 },
    { x: 1, y: 1, z: -1 }, { x: -1, y: 1, z: -1 },
    { x: -1, y: -1, z: 1 }, { x: 1, y: -1, z: 1 },
    { x: 1, y: 1, z: 1 }, { x: -1, y: 1, z: 1 }
  ];
  const f = [
    [0,1,2],[0,2,3],
    [4,5,6],[4,6,7],
    [0,3,7],[0,7,4],
    [1,5,6],[1,6,2],
    [0,1,5],[0,5,4],
    [3,2,6],[3,6,7]
  ];
  return makeMesh(v, f, { r: 70, g: 130, b: 230 });
}

function buildPyramid() {
  const v = [
    { x: -1, y: -0.4, z: -1 }, { x: 1, y: -0.4, z: -1 },
    { x: 1, y: -0.4, z: 1 }, { x: -1, y: -0.4, z: 1 },
    { x: 0, y: 0.9, z: 0 }
  ];
  const f = [
    [0,1,2],[0,2,3],
    [0,1,4],[1,2,4],[2,3,4],[3,0,4]
  ];
  return makeMesh(v, f, { r: 235, g: 120, b: 60 });
}

function buildOctahedron() {
  const v = [
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 }
  ];
  const f = [
    [0,2,4],[2,1,4],[1,3,4],[3,0,4],
    [2,0,5],[1,2,5],[3,1,5],[0,3,5]
  ];
  return makeMesh(v, f, { r: 60, g: 175, b: 120 });
}

const meshes = {
  cube: buildCube(),
  pyramid: buildPyramid(),
  octahedron: buildOctahedron()
};

// --- state driven by the ui ---
let currentMesh = meshes.cube;
let angleX = 0.4, angleY = 0.3;
let speedX = 0.6, speedY = 0.9;
let camDist = 4.5;
let autoRotate = true, solidFill = true, wireframeOn = true, cullOn = true;

document.getElementById('meshSelect').addEventListener('change', e => {
  currentMesh = meshes[e.target.value];
});
document.getElementById('speedX').addEventListener('input', e => {
  speedX = parseFloat(e.target.value);
  document.getElementById('speedXVal').textContent = speedX.toFixed(1);
});
document.getElementById('speedY').addEventListener('input', e => {
  speedY = parseFloat(e.target.value);
  document.getElementById('speedYVal').textContent = speedY.toFixed(1);
});
document.getElementById('zoom').addEventListener('input', e => {
  camDist = parseFloat(e.target.value);
  document.getElementById('zoomVal').textContent = camDist.toFixed(1);
});
document.getElementById('autoRotate').addEventListener('change', e => autoRotate = e.target.checked);
document.getElementById('solidFill').addEventListener('change', e => solidFill = e.target.checked);
document.getElementById('wireframe').addEventListener('change', e => wireframeOn = e.target.checked);
document.getElementById('backfaceCull').addEventListener('change', e => cullOn = e.target.checked);

// manual orbit by dragging
let dragging = false, lastX = 0, lastY = 0;
canvas.addEventListener('mousedown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener('mouseup', () => dragging = false);
window.addEventListener('mousemove', e => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  angleY += dx * 0.008;
  angleX += dy * 0.008;
  lastX = e.clientX;
  lastY = e.clientY;
});
canvas.addEventListener('wheel', e => {
  camDist += e.deltaY * 0.003;
  camDist = Math.max(2.5, Math.min(10, camDist));
  e.preventDefault();
}, { passive: false });

const lightDir = normalize({ x: -0.4, y: 0.6, z: -1 });
const fov = Math.PI / 3;

function edgeFn(a, b, c) {
  return (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x);
}

function project(camPoint) {
  const f = 1 / Math.tan(fov / 2);
  const aspect = width / height;
  const ndcX = (camPoint.x * f / aspect) / camPoint.z;
  const ndcY = (camPoint.y * f) / camPoint.z;
  return {
    x: (ndcX + 1) * 0.5 * width,
    y: (1 - (ndcY + 1) * 0.5) * height,
    invz: 1 / camPoint.z
  };
}

function rasterizeTriangle(p0, p1, p2, color, data) {
  const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x)));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
  const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y)));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));

  const area = edgeFn(p0, p1, p2);
  if (area === 0) return;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const p = { x: x + 0.5, y: y + 0.5 };
      let w0 = edgeFn(p1, p2, p);
      let w1 = edgeFn(p2, p0, p);
      let w2 = edgeFn(p0, p1, p);

      const inside = (w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0);
      if (!inside) continue;

      w0 /= area; w1 /= area; w2 /= area;
      const invz = w0 * p0.invz + w1 * p1.invz + w2 * p2.invz;

      const idx = y * width + x;
      if (invz > zbuffer[idx]) {
        zbuffer[idx] = invz;
        const di = idx * 4;
        data[di] = color.r;
        data[di + 1] = color.g;
        data[di + 2] = color.b;
        data[di + 3] = 255;
      }
    }
  }
}

let triCount = 0;

function renderFrame() {
  const data = imgData.data;
  data.fill(255);
  for (let i = 0; i < data.length; i += 4) data[i + 3] = 255;
  zbuffer.fill(0);
  triCount = 0;

  const model = multiplyMat4(rotationY(angleY), rotationX(angleX));
  const view = translation(0, 0, camDist);
  const modelView = multiplyMat4(view, model);

  const camVerts = currentMesh.vertices.map(v => transformPoint(modelView, v));
  const screenVerts = camVerts.map(v => project(v));

  for (const face of currentMesh.faces) {
    const v0 = camVerts[face[0]], v1 = camVerts[face[1]], v2 = camVerts[face[2]];
    if (v0.z <= 0.1 || v1.z <= 0.1 || v2.z <= 0.1) continue; // behind camera, skip

    const normal = cross(sub(v1, v0), sub(v2, v0));
    const facing = dot(normal, v0);
    const isBackface = facing >= 0;

    if (cullOn && isBackface) continue;

    const p0 = screenVerts[face[0]], p1 = screenVerts[face[1]], p2 = screenVerts[face[2]];

    if (solidFill) {
      const n = normalize(normal);
      const diffuse = Math.max(0, dot(n, lightDir));
      const brightness = 0.3 + 0.7 * diffuse;
      const color = {
        r: Math.min(255, currentMesh.color.r * brightness),
        g: Math.min(255, currentMesh.color.g * brightness),
        b: Math.min(255, currentMesh.color.b * brightness)
      };
      rasterizeTriangle(p0, p1, p2, color, data);
      triCount++;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  if (wireframeOn) {
    ctx.strokeStyle = 'rgba(20,25,35,0.55)';
    ctx.lineWidth = 1;
    for (const face of currentMesh.faces) {
      const v0 = camVerts[face[0]], v1 = camVerts[face[1]], v2 = camVerts[face[2]];
      if (v0.z <= 0.1 || v1.z <= 0.1 || v2.z <= 0.1) continue;

      const normal = cross(sub(v1, v0), sub(v2, v0));
      if (cullOn && dot(normal, v0) >= 0) continue;

      const p0 = screenVerts[face[0]], p1 = screenVerts[face[1]], p2 = screenVerts[face[2]];
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.closePath();
      ctx.stroke();
    }
  }
}

let lastTime = performance.now();
let fpsAccum = 0, fpsFrames = 0, fpsTimer = 0;

function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (autoRotate) {
    angleX += speedX * dt * 0.5;
    angleY += speedY * dt * 0.5;
  }

  renderFrame();

  fpsFrames++;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    document.getElementById('fps').textContent = Math.round(fpsFrames / fpsTimer);
    document.getElementById('triCount').textContent = triCount;
    fpsFrames = 0;
    fpsTimer = 0;
  }

  requestAnimationFrame(loop);
}

resize();
requestAnimationFrame(loop);