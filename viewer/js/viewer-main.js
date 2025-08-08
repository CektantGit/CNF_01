import * as THREE from 'three';
import { OrbitControls } from 'OrbitControls';
import { GLTFLoader } from 'GLTFLoader';
import { GLTFExporter } from 'GLTFExporter';
import { USDZExporter } from 'USDZExporter';
import { ViewerState } from './viewer-state.js';
import { renderSlots } from './viewer-ui.js';
import { fetchObjectDetails } from './viewer-api.js';

const container = document.getElementById('viewerCanvas');
const slotPanel = document.getElementById('slotPanel');
const importBtn = document.getElementById('importBtn');
const importInput = document.getElementById('importInput');
const arBtn = document.getElementById('arBtn');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setClearColor(0xffffff, 1);
container.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
camera.position.set(3, 3, 3);
controls.update();

const ambient = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambient);
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(5, 10, 7);
scene.add(dir);

function resize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

const state = new ViewerState();
const loader = new GLTFLoader();

function showLoading(r) {
  const overlay = document.getElementById('loadingOverlay');
  const bar = document.getElementById('progressBar');
  overlay.style.display = 'flex';
  bar.style.width = Math.floor(r * 100) + '%';
}
function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
  document.getElementById('progressBar').style.width = '0';
}

async function loadMesh(obj) {
  if (obj.mesh) return obj.mesh;
  const mat = obj.materials[obj.selectedMaterial || 0];
  const url = mat?.native?.glbUrl;
  if (!url) return null;
  return await new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => {
        obj.mesh = gltf.scene;
        resolve(obj.mesh);
      },
      (evt) => {
        if (evt.total) showLoading(evt.loaded / evt.total);
      },
      (err) => {
        console.error(err);
        hideLoading();
        resolve(null);
      }
    );
  });
}

async function selectObject(slotIdx, objIdx, matIdx) {
  const slot = state.slots[slotIdx];
  if (slot.currentMesh) {
    scene.remove(slot.currentMesh);
    slot.currentMesh = null;
  }
  slot.selectedIndex = objIdx;
  if (objIdx === -1) {
    renderSlots(slotPanel, state, selectObject);
    return;
  }
  const obj = slot.objects[objIdx];
  if (typeof matIdx === 'number') obj.selectedMaterial = matIdx;
  obj.mesh = null; // force reload for new material
  const mesh = await loadMesh(obj);
  hideLoading();
  if (!mesh) {
    renderSlots(slotPanel, state, selectObject);
    return;
  }
  const inst = mesh.clone();
  inst.position.fromArray(obj.transform.position);
  inst.rotation.set(
    ...obj.transform.rotation.map((r) => THREE.MathUtils.degToRad(r))
  );
  inst.scale.fromArray(obj.transform.scale);
  slot.currentMesh = inst;
  scene.add(inst);
  renderSlots(slotPanel, state, selectObject);
}

async function handleImport(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  // remove previous meshes from scene
  state.slots.forEach((s) => {
    if (s.currentMesh) {
      scene.remove(s.currentMesh);
      s.currentMesh = null;
    }
  });

  await state.loadConfig(data, fetchObjectDetails);
  renderSlots(slotPanel, state, selectObject);
  for (let i = 0; i < state.slots.length; i++) {
    const slot = state.slots[i];
    if (slot.selectedIndex >= 0) {
      const obj = slot.objects[slot.selectedIndex];
      await selectObject(i, slot.selectedIndex, obj.selectedMaterial);
    }
  }
}

importBtn.addEventListener('click', () => importInput.click());
importInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleImport(file);
});

arBtn.addEventListener('click', async () => {
  const meshes = state.slots.map((s) => s.currentMesh).filter(Boolean);
  if (!meshes.length) return;

  const group = new THREE.Group();
  meshes.forEach((m) => group.add(m.clone(true)));
  group.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry = obj.geometry.clone();
      obj.material = obj.material.clone();
      obj.userData = {};
    }
    obj.updateMatrixWorld(true);
  });

  // center group so exported model is around origin
  const box = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  box.getCenter(center);
  group.children.forEach((c) => c.position.sub(center));

  if (isAndroid()) {
    const exporter = new GLTFExporter();
    const arrayBuffer = await exporter.parseAsync(group, { binary: true });
    const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);
    const intent = `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(url)}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;end;`;
    const a = document.createElement('a');
    a.href = intent;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } else if (isIOS()) {
    const exporter = new USDZExporter();
    const arrayBuffer = await exporter.parseAsync(group);
    const blob = new Blob([arrayBuffer], { type: 'model/vnd.usdz+zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.rel = 'ar';
    a.href = url;
    a.setAttribute('download', 'scene.usdz');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } else {
    alert('AR not supported');
  }
});

function isAndroid() {
  return /android/i.test(navigator.userAgent);
}
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}
