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

window.addEventListener('resize', () => {
  renderer.setSize(viewer.clientWidth, viewer.clientHeight);
  camera.aspect = viewer.clientWidth / viewer.clientHeight;
  camera.updateProjectionMatrix();
});

const meshes = {};

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

function updateScene() {
  Object.keys(meshes).forEach(id => {
    scene.remove(meshes[id]);
    if (transform.object === meshes[id]) transform.detach();
    delete meshes[id];
  });
  state.slots.forEach(slot => {
    if (slot.selectedObjectIndex !== -1) {
      const obj = slot.objects[slot.selectedObjectIndex];
      loadObject(slot, obj);
    }
  });
}

function loadObject(slot, obj) {
  const mat = obj.materials[obj.selectedMaterial];
  const url = mat?.native?.glbUrl;
  if (!url) return;
  loader.load(url, gltf => {
    const mesh = gltf.scene;
    mesh.position.fromArray(obj.transform.position);
    mesh.rotation.set(
      THREE.MathUtils.degToRad(obj.transform.rotation[0]),
      THREE.MathUtils.degToRad(obj.transform.rotation[1]),
      THREE.MathUtils.degToRad(obj.transform.rotation[2])
    );
    mesh.scale.fromArray(obj.transform.scale);
    scene.add(mesh);
    meshes[slot.id] = mesh;
    attachTransform(mesh, obj);
  });
}

function attachTransform(mesh, obj) {
  transform.attach(mesh);
  transform.enabled = transform.mode !== undefined && transform.mode !== '';
  transform.addEventListener('objectChange', () => {
    obj.transform.position = [mesh.position.x, mesh.position.y, mesh.position.z];
    obj.transform.rotation = [
      THREE.MathUtils.radToDeg(mesh.rotation.x),
      THREE.MathUtils.radToDeg(mesh.rotation.y),
      THREE.MathUtils.radToDeg(mesh.rotation.z)
    ];
    obj.transform.scale = [mesh.scale.x, mesh.scale.y, mesh.scale.z];
  });
}

// UI callbacks
const slotCallbacks = {
  onSelect(index) {
    state.currentSlotIndex = index;
    renderSlots(state, slotListEl, slotCallbacks);
    renderObjects(state.currentSlot, objectsContainer, objectCallbacks);
    updateScene();
  },
  onDelete(id) {
    state.removeSlot(id);
    renderSlots(state, slotListEl, slotCallbacks);
    renderObjects(state.currentSlot, objectsContainer, objectCallbacks);
    updateScene();
  }
};

const objectCallbacks = {
  onSelectObject(index) {
    state.currentSlot.selectedObjectIndex = index;
    renderObjects(state.currentSlot, objectsContainer, objectCallbacks);
    updateScene();
  },
  onSelectMaterial(objIndex, matIndex) {
    const slot = state.currentSlot;
    const obj = slot.objects[objIndex];
    obj.selectedMaterial = matIndex;
    if (slot.selectedObjectIndex === objIndex) {
      loadObject(slot, obj);
    }
  },
  onDelete(objIndex) {
    const slot = state.currentSlot;
    slot.objects.splice(objIndex, 1);
    if (slot.selectedObjectIndex >= slot.objects.length) {
      slot.selectedObjectIndex = slot.objects.length - 1;
    }
    renderObjects(slot, objectsContainer, objectCallbacks);
    updateScene();
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
      updateScene();
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

let transformMode = null;
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
updateScene();
