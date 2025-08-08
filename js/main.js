import * as THREE from 'three';
import { OrbitControls } from 'OrbitControls';
import { GLTFLoader } from 'GLTFLoader';
import { TransformControls } from 'TransformControls';
import { ConfiguratorState } from './state.js';
import { renderSlots, renderObjects } from './ui.js';
import { openObjectModal } from './modal.js';
import { fetchObjectDetails } from './api.js';

const state = new ConfiguratorState();

const slotListEl = document.getElementById('slots');
const addSlotBtn = document.getElementById('addSlotBtn');
const addObjectBtn = document.getElementById('addObjectBtn');
const inheritBtn = document.getElementById('inheritBtn');
const objectsContainer = document.getElementById('objects');
const canBeEmptyChk = document.getElementById('canBeEmpty');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importInput = document.getElementById('importInput');
const modalEl = document.getElementById('objectModal');
const moveBtn = document.getElementById('moveBtn');
const rotateBtn = document.getElementById('rotateBtn');
const noneBtn = document.getElementById('noneBtn');
const gridBtn = document.getElementById('gridBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const progressBar = document.getElementById('progressBar');

// THREE.js setup
const viewer = document.getElementById('viewer');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
viewer.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
const camera = new THREE.PerspectiveCamera(60, viewer.clientWidth / viewer.clientHeight, 0.1, 1000);
camera.position.set(0, 1, 3);
const orbit = new OrbitControls(camera, renderer.domElement);
const loader = new GLTFLoader();
const transform = new TransformControls(camera, renderer.domElement);
transform.addEventListener('dragging-changed', e => { orbit.enabled = !e.value; });
scene.add(transform);

// basic lighting so models are visible
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

const grid = new THREE.GridHelper(10, 10);
grid.visible = false;
scene.add(grid);

window.addEventListener('resize', () => {
  renderer.setSize(viewer.clientWidth, viewer.clientHeight);
  camera.aspect = viewer.clientWidth / viewer.clientHeight;
  camera.updateProjectionMatrix();
});

const meshes = {};
let transformMode = null;

function showLoading(){
  loadingOverlay.style.display='flex';
  progressBar.style.width='0%';
}

function updateLoading(p){
  progressBar.style.width = `${Math.round(p*100)}%`;
}

function hideLoading(){
  loadingOverlay.style.display='none';
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

// track transform changes for the currently attached object
transform.addEventListener('objectChange', () => {
  const obj = transform.object?.userData?.stateObj;
  if (!obj) return;
  obj.transform.position = [transform.object.position.x, transform.object.position.y, transform.object.position.z];
  obj.transform.rotation = [
    THREE.MathUtils.radToDeg(transform.object.rotation.x),
    THREE.MathUtils.radToDeg(transform.object.rotation.y),
    THREE.MathUtils.radToDeg(transform.object.rotation.z)
  ];
  obj.transform.scale = [transform.object.scale.x, transform.object.scale.y, transform.object.scale.z];
});

function loadObject(slot, obj, attach = false) {
  const mat = obj.materials[obj.selectedMaterial];
  const url = mat?.native?.glbUrl;
  if (!url) return;
  const loadId = crypto.randomUUID();
  slot._loadId = loadId;
  showLoading();
  loader.load(
    url,
    gltf => {
      if (slot._loadId !== loadId) { hideLoading(); return; }
      const mesh = gltf.scene;
      mesh.position.fromArray(obj.transform.position);
      mesh.rotation.set(
        THREE.MathUtils.degToRad(obj.transform.rotation[0]),
        THREE.MathUtils.degToRad(obj.transform.rotation[1]),
        THREE.MathUtils.degToRad(obj.transform.rotation[2])
      );
      mesh.scale.fromArray(obj.transform.scale);
      mesh.userData.stateObj = obj;
      scene.add(mesh);
      meshes[slot.id] = mesh;
      if (attach && transformMode !== null) attachTransformControls(mesh, obj);
      hideLoading();
    },
    xhr => {
      if (xhr.total) updateLoading(xhr.loaded / xhr.total);
    },
    err => {
      console.error('Load error', err);
      hideLoading();
    }
  );
}

function loadSlot(slot, attach = false) {
  const existing = meshes[slot.id];
  if (existing) {
    if (transform.object === existing) transform.detach();
    scene.remove(existing);
    delete meshes[slot.id];
  }
  if (slot.hidden || slot.selectedObjectIndex === -1) return;
  const obj = slot.objects[slot.selectedObjectIndex];
  loadObject(slot, obj, attach && transformMode !== null);
}

function attachTransformControls(mesh, obj) {
  if (transformMode === null) return;
  mesh.userData.stateObj = obj;
  transform.attach(mesh);
  transform.enabled = true;
}

function activateSlot(slot) {
  if (transformMode === null) {
    transform.detach();
  }
  if (!slot || slot.selectedObjectIndex === -1 || slot.hidden) {
    transform.detach();
    return;
  }
  const mesh = meshes[slot.id];
  if (mesh) {
    if (transformMode !== null) transform.attach(mesh);
  } else {
    loadSlot(slot, transformMode !== null);
  }
  transform.enabled = transformMode !== null;
}

// UI callbacks
const slotCallbacks = {
  onSelect(index) {
    state.currentSlotIndex = index;
    renderSlots(state, slotListEl, slotCallbacks);
    renderObjects(state.currentSlot, objectsContainer, objectCallbacks);
    canBeEmptyChk.checked = state.currentSlot?.canBeEmpty || false;
    activateSlot(state.currentSlot);
  },
  onDelete(id) {
    const mesh = meshes[id];
    if (mesh) {
      if (transform.object === mesh) transform.detach();
      scene.remove(mesh);
      delete meshes[id];
    }
    state.removeSlot(id);
    renderSlots(state, slotListEl, slotCallbacks);
    renderObjects(state.currentSlot, objectsContainer, objectCallbacks);
    canBeEmptyChk.checked = state.currentSlot?.canBeEmpty || false;
    activateSlot(state.currentSlot);
  },
  onToggleHide(slot) {
    slot.hidden = !slot.hidden;
    const mesh = meshes[slot.id];
    if (slot.hidden) {
      if (mesh) {
        if (transform.object === mesh) transform.detach();
        scene.remove(mesh);
        delete meshes[slot.id];
      }
    } else {
      loadSlot(slot, slot === state.currentSlot);
    }
    renderSlots(state, slotListEl, slotCallbacks);
  }
};

const objectCallbacks = {
  onSelectObject(index) {
    const slot = state.currentSlot;
    slot.selectedObjectIndex = index;
    renderObjects(slot, objectsContainer, objectCallbacks);
    loadSlot(slot, true);
  },
  onSelectMaterial(objIndex, matIndex) {
    const slot = state.currentSlot;
    slot.selectedObjectIndex = objIndex;
    const obj = slot.objects[objIndex];
    obj.selectedMaterial = matIndex;
    renderObjects(slot, objectsContainer, objectCallbacks);
    loadSlot(slot, true);
  },
  onDelete(objIndex) {
    const slot = state.currentSlot;
    slot.objects.splice(objIndex, 1);
    if (slot.selectedObjectIndex >= slot.objects.length) {
      slot.selectedObjectIndex = slot.objects.length - 1;
    }
    renderObjects(slot, objectsContainer, objectCallbacks);
    loadSlot(slot, true);
  }
};

addSlotBtn.addEventListener('click', () => {
  state.addSlot();
  renderSlots(state, slotListEl, slotCallbacks);
  renderObjects(state.currentSlot, objectsContainer, objectCallbacks);
  canBeEmptyChk.checked = state.currentSlot?.canBeEmpty || false;
});

addObjectBtn.addEventListener('click', () => {
  if (!state.currentSlot) return;
  openObjectModal(modalEl, {
    onSelect(objData) {
      state.addObjectToCurrent(objData);
      renderObjects(state.currentSlot, objectsContainer, objectCallbacks);
      loadSlot(state.currentSlot, true);
    }
  });
});

exportBtn.addEventListener('click', () => {
  const json = state.exportJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'config.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

importBtn.addEventListener('click', () => importInput.click());
importInput.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await handleImport(data);
  } catch (err) {
    console.error('Import failed', err);
  }
  importInput.value = '';
});

moveBtn.addEventListener('click', () => {
  transformMode = 'translate';
  transform.setMode('translate');
  transform.enabled = true;
  if (transform.object) {
    transform.attach(transform.object);
  } else {
    const mesh = meshes[state.currentSlot?.id];
    if (mesh) transform.attach(mesh);
  }
});

rotateBtn.addEventListener('click', () => {
  transformMode = 'rotate';
  transform.setMode('rotate');
  transform.enabled = true;
  if (transform.object) {
    transform.attach(transform.object);
  } else {
    const mesh = meshes[state.currentSlot?.id];
    if (mesh) transform.attach(mesh);
  }
});

noneBtn.addEventListener('click', () => {
  transformMode = null;
  transform.enabled = false;
  transform.detach();
});

gridBtn.addEventListener('click', () => {
  grid.visible = !grid.visible;
  gridBtn.classList.toggle('active', grid.visible);
});

inheritBtn.addEventListener('click', () => {
  const slot = state.currentSlot;
  state.inheritFromFirst(slot);
  if (slot) loadSlot(slot, true);
});

canBeEmptyChk.addEventListener('change', () => {
  const slot = state.currentSlot;
  if (slot) slot.canBeEmpty = canBeEmptyChk.checked;
});

async function handleImport(data) {
  Object.values(meshes).forEach(m => {
    if (transform.object === m) transform.detach();
    scene.remove(m);
  });
  Object.keys(meshes).forEach(k => delete meshes[k]);

  await state.importJSON(data, fetchObjectDetails);

  renderSlots(state, slotListEl, slotCallbacks);
  renderObjects(state.currentSlot, objectsContainer, objectCallbacks);
  canBeEmptyChk.checked = state.currentSlot?.canBeEmpty || false;

  state.slots.forEach((slot, idx) => {
    loadSlot(slot, idx === state.currentSlotIndex);
  });
}

// initialize
state.addSlot();
renderSlots(state, slotListEl, slotCallbacks);
renderObjects(state.currentSlot, objectsContainer, objectCallbacks);
canBeEmptyChk.checked = state.currentSlot?.canBeEmpty || false;
activateSlot(state.currentSlot);
