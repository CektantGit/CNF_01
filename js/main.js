import * as THREE from 'three';
import { OrbitControls } from 'OrbitControls';
import { GLTFLoader } from 'GLTFLoader';
import { TransformControls } from 'TransformControls';
import { ConfiguratorState } from './state.js';
import { renderSlots, renderObjects } from './ui.js';
import { openObjectModal } from './modal.js';

const state = new ConfiguratorState();

const slotListEl = document.getElementById('slots');
const addSlotBtn = document.getElementById('addSlotBtn');
const addObjectBtn = document.getElementById('addObjectBtn');
const objectsContainer = document.getElementById('objects');
const exportBtn = document.getElementById('exportBtn');
const modalEl = document.getElementById('objectModal');
const transformBtn = document.getElementById('transformModeBtn');

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

window.addEventListener('resize', () => {
  renderer.setSize(viewer.clientWidth, viewer.clientHeight);
  camera.aspect = viewer.clientWidth / viewer.clientHeight;
  camera.updateProjectionMatrix();
});

const meshes = {};
let transformMode = null;

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
  loader.load(url, gltf => {
    if (slot._loadId !== loadId) return; // stale load
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
    if (attach) attachTransformControls(mesh, obj);
  });
}

function loadSlot(slot, attach = false) {
  const existing = meshes[slot.id];
  if (existing) {
    if (transform.object === existing) transform.detach();
    scene.remove(existing);
    delete meshes[slot.id];
  }
  if (slot.selectedObjectIndex === -1) return;
  const obj = slot.objects[slot.selectedObjectIndex];
  loadObject(slot, obj, attach);
}

function attachTransformControls(mesh, obj) {
  mesh.userData.stateObj = obj;
  transform.attach(mesh);
  transform.enabled = transformMode !== null;
}

function activateSlot(slot) {
  if (!slot || slot.selectedObjectIndex === -1) {
    transform.detach();
    return;
  }
  const mesh = meshes[slot.id];
  if (mesh) {
    transform.attach(mesh);
    transform.enabled = transformMode !== null;
  } else {
    loadSlot(slot, true);
  }
}

// UI callbacks
const slotCallbacks = {
  onSelect(index) {
    state.currentSlotIndex = index;
    renderSlots(state, slotListEl, slotCallbacks);
    renderObjects(state.currentSlot, objectsContainer, objectCallbacks);
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
    activateSlot(state.currentSlot);
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
    const obj = slot.objects[objIndex];
    obj.selectedMaterial = matIndex;
    if (slot.selectedObjectIndex === objIndex) {
      loadSlot(slot, true);
    }
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

transformBtn.addEventListener('click', () => {
  if (transformMode === null) {
    transformMode = 'translate';
    transform.setMode('translate');
    transform.enabled = true;
  } else if (transformMode === 'translate') {
    transformMode = 'rotate';
    transform.setMode('rotate');
  } else {
    transformMode = null;
    transform.enabled = false;
    transform.detach();
  }
});

// initialize
state.addSlot();
renderSlots(state, slotListEl, slotCallbacks);
renderObjects(state.currentSlot, objectsContainer, objectCallbacks);
activateSlot(state.currentSlot);
