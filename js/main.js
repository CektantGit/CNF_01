import * as THREE from 'three';
import { OrbitControls } from 'OrbitControls';
import { GLTFLoader } from 'GLTFLoader';
import { RGBELoader } from 'RGBELoader';
import { TransformControls } from 'TransformControls';
import { EffectComposer } from 'EffectComposer';
import { RenderPass } from 'RenderPass';
import { OutlinePass } from 'OutlinePass';
import { ShaderPass } from 'ShaderPass';
import { FXAAShader } from 'FXAAShader';
import { OutputPass } from 'OutputPass';
import { ConfiguratorState } from './state.js';
import { renderSlots, renderObjects, renderSlotsMobile } from './ui.js';
import { openObjectModal, openStepsModal } from './modal.js';
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
const stepsBtn = document.getElementById('stepsBtn');
const stepsModal = document.getElementById('stepsModal');
const modalEl = document.getElementById('objectModal');
const moveBtn = document.getElementById('moveBtn');
const rotateBtn = document.getElementById('rotateBtn');
const noneBtn = document.getElementById('noneBtn');
const gridBtn = document.getElementById('gridBtn');
const outlineBtn = document.getElementById('outlineBtn');
const coordsPanel = document.getElementById('coordsPanel');
const coordX = document.getElementById('coordX');
const coordY = document.getElementById('coordY');
const coordZ = document.getElementById('coordZ');
const loadingOverlay = document.getElementById('loadingOverlay');
const progressBar = document.getElementById('progressBar');
outlineBtn.classList.add('active');

// THREE.js setup
const viewer = document.getElementById('viewer');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.LinearToneMapping;
renderer.physicallyCorrectLights = true;
renderer.setClearColor(0xffffff, 1);
viewer.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
new RGBELoader().load(
  'https://raw.githubusercontent.com/donmccurdy/three-gltf-viewer/master/assets/environment/neutral.hdr',
  (hdr) => {
    const envMap = pmrem.fromEquirectangular(hdr).texture;
    scene.environment = envMap;
    scene.background = envMap;
    hdr.dispose();
    pmrem.dispose();
  }
);
const camera = new THREE.PerspectiveCamera(60, viewer.clientWidth / viewer.clientHeight, 0.1, 1000);
camera.position.set(0, 1, 3);
const orbit = new OrbitControls(camera, renderer.domElement);
const loader = new GLTFLoader();
const transform = new TransformControls(camera, renderer.domElement);
transform.addEventListener('dragging-changed', e => { orbit.enabled = !e.value; });
const gizmoScene = new THREE.Scene();
gizmoScene.add(transform);

// postprocessing for hover outline
const composer = new EffectComposer(renderer);
composer.setSize(viewer.clientWidth, viewer.clientHeight);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const outlinePass = new OutlinePass(
  new THREE.Vector2(viewer.clientWidth, viewer.clientHeight),
  scene,
  camera
);
outlinePass.edgeStrength = 2;
outlinePass.edgeThickness = 1;
outlinePass.visibleEdgeColor.set(0x008efa);
outlinePass.hiddenEdgeColor.set(0xffffff);
// ensure the outline blends normally over the scene
outlinePass.overlayMaterial.blending = THREE.NormalBlending;
outlinePass.overlayMaterial.transparent = true;
composer.addPass(outlinePass);
const outputPass = new OutputPass();
composer.addPass(outputPass);
const effectFXAA = new ShaderPass(FXAAShader);
effectFXAA.uniforms['resolution'].value.set(1 / viewer.clientWidth, 1 / viewer.clientHeight);
composer.addPass(effectFXAA);

// lighting similar to gltf-viewer defaults
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
dirLight.position.set(5, 10, 7.5);
scene.add(dirLight);

const grid = new THREE.GridHelper(10, 10);
grid.visible = false;
scene.add(grid);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDown = null;
let pointerMoved = false;
let hovered = null;

function isMobile(){
  return window.innerWidth <= 768;
}

function handleResize(){
  renderer.setSize(viewer.clientWidth, viewer.clientHeight);
  composer.setSize(viewer.clientWidth, viewer.clientHeight);
  effectFXAA.uniforms['resolution'].value.set(1 / viewer.clientWidth, 1 / viewer.clientHeight);
  camera.aspect = viewer.clientWidth / viewer.clientHeight;
  camera.updateProjectionMatrix();
  renderUI();
}

window.addEventListener('resize', handleResize);

const meshes = {};
let transformMode = null;

const axisNames = ['x','y','z'];

function updateCoordInputs(){
  if (transformMode === null || !transform.object) {
    coordsPanel.style.display = 'none';
    return;
  }
  coordsPanel.style.display = 'flex';
  if (transformMode === 'translate') {
    coordX.value = transform.object.position.x.toFixed(2);
    coordY.value = transform.object.position.y.toFixed(2);
    coordZ.value = transform.object.position.z.toFixed(2);
  } else if (transformMode === 'rotate') {
    coordX.value = THREE.MathUtils.radToDeg(transform.object.rotation.x).toFixed(1);
    coordY.value = THREE.MathUtils.radToDeg(transform.object.rotation.y).toFixed(1);
    coordZ.value = THREE.MathUtils.radToDeg(transform.object.rotation.z).toFixed(1);
  }
}

[coordX, coordY, coordZ].forEach((input, idx) => {
  input.addEventListener('focus', () => input.select());
  input.addEventListener('change', () => {
    if (!transform.object) return;
    const val = parseFloat(input.value);
    if (isNaN(val)) return;
    const obj = transform.object.userData.stateObj;
    if (transformMode === 'translate') {
      transform.object.position[axisNames[idx]] = val;
      obj.transform.position[idx] = val;
    } else if (transformMode === 'rotate') {
      const rad = THREE.MathUtils.degToRad(val);
      transform.object.rotation[axisNames[idx]] = rad;
      obj.transform.rotation[idx] = val;
    }
    updateCoordInputs();
  });
});

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
  composer.render();
  renderer.autoClear = false;
  renderer.render(gizmoScene, camera);
  renderer.autoClear = true;
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
  updateCoordInputs();
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
      mesh.userData.slotId = slot.id;
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
  if (slot.hidden || slot.selectedObjectIndex === -1) {
    updateCoordInputs();
    return;
  }
  const obj = slot.objects[slot.selectedObjectIndex];
  loadObject(slot, obj, attach && transformMode !== null);
}

function attachTransformControls(mesh, obj) {
  if (transformMode === null) return;
  mesh.userData.stateObj = obj;
  transform.attach(mesh);
  transform.enabled = true;
  updateCoordInputs();
}

function activateSlot(slot) {
  if (transformMode === null) {
    transform.detach();
  }
  if (!slot || slot.selectedObjectIndex === -1 || slot.hidden) {
    transform.detach();
    updateCoordInputs();
    return;
  }
  const mesh = meshes[slot.id];
  if (mesh) {
    if (transformMode !== null) transform.attach(mesh);
  } else {
    loadSlot(slot, transformMode !== null);
  }
  transform.enabled = transformMode !== null;
  updateCoordInputs();
}

function setHovered(obj) {
  if (hovered === obj) return;
  hovered = obj;
  outlinePass.selectedObjects = obj ? [obj] : [];
}

function handleHover(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const intersect = raycaster.intersectObjects(Object.values(meshes), true)[0];
  let obj = intersect ? intersect.object : null;
  while (obj && !obj.userData.slotId) obj = obj.parent;
  setHovered(obj);
}

function handleSceneClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const intersect = raycaster.intersectObjects(Object.values(meshes), true)[0];
  if (!intersect) return;
  let obj = intersect.object;
  while (obj && !obj.userData.slotId) obj = obj.parent;
  if (!obj || !obj.userData.slotId) return;
  const slotIndex = state.slots.findIndex(s => s.id === obj.userData.slotId);
  if (slotIndex === -1) return;
  const slot = state.slots[slotIndex];
  const objIdx = slot.objects.indexOf(obj.userData.stateObj);
  if (objIdx !== -1) slot.selectedObjectIndex = objIdx;
  slotCallbacks.onSelect(slotIndex);
}

// UI callbacks
const slotCallbacks = {
  onSelect(index) {
    state.currentSlotIndex = index;
    renderUI();
    canBeEmptyChk.checked = state.currentSlot?.canBeEmpty || false;
    activateSlot(state.currentSlot);
    const el = slotListEl.children[index];
    if (el) el.scrollIntoView({ block: 'nearest' });
  },
  onDelete(id) {
    const mesh = meshes[id];
    if (mesh) {
      if (transform.object === mesh) transform.detach();
      scene.remove(mesh);
      delete meshes[id];
    }
    state.removeSlot(id);
    renderUI();
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
    renderUI();
  }
};

const objectCallbacks = {
  onSelectObject(index) {
    const slot = state.currentSlot;
    slot.selectedObjectIndex = index;
    renderUI();
    loadSlot(slot, true);
  },
  onSelectMaterial(objIndex, matIndex) {
    const slot = state.currentSlot;
    slot.selectedObjectIndex = objIndex;
    const obj = slot.objects[objIndex];
    obj.selectedMaterial = matIndex;
    renderUI();
    loadSlot(slot, true);
  },
  onDelete(objIndex) {
    const slot = state.currentSlot;
    slot.objects.splice(objIndex, 1);
    if (slot.selectedObjectIndex >= slot.objects.length) {
      slot.selectedObjectIndex = slot.objects.length - 1;
    }
    renderUI();
    loadSlot(slot, true);
  }
};

addSlotBtn.addEventListener('click', () => {
  state.addSlot();
  renderUI();
  canBeEmptyChk.checked = state.currentSlot?.canBeEmpty || false;
});

addObjectBtn.addEventListener('click', () => {
  if (!state.currentSlot) return;
  openObjectModal(modalEl, {
    async onSelect(objData) {
      const details = await fetchObjectDetails(objData.uuid);
      if (!details) return;
      state.addObjectToCurrent(details);
      renderUI();
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

stepsBtn.addEventListener('click', () => {
  openStepsModal(stepsModal, state, renderUI);
});

function updateTransformButtons() {
  moveBtn.classList.toggle('active', transformMode === 'translate');
  rotateBtn.classList.toggle('active', transformMode === 'rotate');
  noneBtn.classList.toggle('active', transformMode === null);
}

function setTransformMode(mode) {
  if (mode === transformMode) {
    if (mode === null) return; // already none
    transformMode = null;
  } else {
    transformMode = mode;
  }

  if (transformMode === null) {
    transform.enabled = false;
    transform.detach();
  } else {
    transform.setMode(transformMode);
    transform.enabled = true;
    const mesh = transform.object || meshes[state.currentSlot?.id];
    if (mesh) transform.attach(mesh);
  }

  updateTransformButtons();
  updateCoordInputs();
}

moveBtn.addEventListener('click', () => setTransformMode('translate'));
rotateBtn.addEventListener('click', () => setTransformMode('rotate'));
noneBtn.addEventListener('click', () => setTransformMode(null));

gridBtn.addEventListener('click', () => {
  grid.visible = !grid.visible;
  gridBtn.classList.toggle('active', grid.visible);
});

outlineBtn.addEventListener('click', () => {
  outlinePass.enabled = !outlinePass.enabled;
  outlineBtn.classList.toggle('active', outlinePass.enabled);
});

renderer.domElement.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  pointerDown = { x: e.clientX, y: e.clientY };
  pointerMoved = false;
});

renderer.domElement.addEventListener('pointermove', e => {
  handleHover(e);
  if (!pointerDown) return;
  if (Math.abs(e.clientX - pointerDown.x) > 5 || Math.abs(e.clientY - pointerDown.y) > 5) {
    pointerMoved = true;
  }
});

renderer.domElement.addEventListener('pointerleave', () => {
  setHovered(null);
});

renderer.domElement.addEventListener('pointerup', e => {
  if (e.button !== 0 || !pointerDown) return;
  if (!pointerMoved) handleSceneClick(e);
  handleHover(e);
  pointerDown = null;
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

  setTransformMode(null);
  await state.importJSON(data, fetchObjectDetails);

  renderUI();
  canBeEmptyChk.checked = state.currentSlot?.canBeEmpty || false;

  state.slots.forEach((slot, idx) => {
    loadSlot(slot, idx === state.currentSlotIndex);
  });
}

// initialize
state.addSlot();

function renderUI(){
  if(isMobile()){
    objectsContainer.parentElement.style.display='none';
    renderSlotsMobile(state, slotListEl, slotCallbacks, objectCallbacks);
  }else{
    objectsContainer.parentElement.style.display='block';
    renderSlots(state, slotListEl, slotCallbacks);
    renderObjects(state.currentSlot, objectsContainer, objectCallbacks);
  }
}

renderUI();
canBeEmptyChk.checked = state.currentSlot?.canBeEmpty || false;
activateSlot(state.currentSlot);
updateTransformButtons();
