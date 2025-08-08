import * as THREE from 'three';
import { OrbitControls } from 'OrbitControls';
import { GLTFLoader } from 'GLTFLoader';
import { RGBELoader } from 'RGBELoader';
import { GLTFExporter } from 'GLTFExporter';
import { USDZExporter } from 'USDZExporter';
import { EffectComposer } from 'EffectComposer';
import { RenderPass } from 'RenderPass';
import { OutlinePass } from 'OutlinePass';
import { ShaderPass } from 'ShaderPass';
import { FXAAShader } from 'FXAAShader';
import { OutputPass } from 'OutputPass';
import { ViewerState } from './viewer-state.js';
import { renderSlots } from './viewer-ui.js';
import { fetchObjectDetails } from './viewer-api.js';

const container = document.getElementById('viewerCanvas');
const slotPanel = document.getElementById('slotPanel');
const importBtn = document.getElementById('importBtn');
const importInput = document.getElementById('importInput');
const arBtn = document.getElementById('arBtn');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.LinearToneMapping;
renderer.physicallyCorrectLights = true;
renderer.setClearColor(0xffffff, 1);
container.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
camera.position.set(0, 1, 3);
controls.update();

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

const ambient = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambient);
const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
dirLight.position.set(5, 10, 7.5);
scene.add(dirLight);

// postprocessing for hover outline
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const outlinePass = new OutlinePass(new THREE.Vector2(1, 1), scene, camera);
outlinePass.edgeStrength = 3;
outlinePass.visibleEdgeColor.set(0x008efa);
outlinePass.hiddenEdgeColor.set(0xffffff);
// ensure the outline blends normally over the scene
outlinePass.overlayMaterial.blending = THREE.NormalBlending;
outlinePass.overlayMaterial.transparent = true;
composer.addPass(outlinePass);
const outputPass = new OutputPass();
composer.addPass(outputPass);
const effectFXAA = new ShaderPass(FXAAShader);
effectFXAA.uniforms['resolution'].value.set(1 / container.clientWidth, 1 / container.clientHeight);
composer.addPass(effectFXAA);

function resize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  outlinePass.setSize(w, h);
  effectFXAA.uniforms['resolution'].value.set(1 / w, 1 / h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function animate() {
  requestAnimationFrame(animate);
  composer.render();
}
animate();

const state = new ViewerState();
const loader = new GLTFLoader();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDown = null;
let pointerMoved = false;
let hovered = null;

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function buildExportScene(srcScene) {
  const group = new THREE.Group();

  srcScene.traverse((child) => {
    if (child.isMesh && child.visible) {
      const clonedMat = Array.isArray(child.material)
        ? child.material.map((m) => {
            const cm = m.clone();
            cm.side = THREE.FrontSide;
            return cm;
          })
        : (() => {
            const cm = child.material.clone();
            cm.side = THREE.FrontSide;
            return cm;
          })();

      const clone = child.clone();
      clone.material = clonedMat;
      clone.geometry = child.geometry.clone();
      child.updateWorldMatrix(true, false);
      clone.applyMatrix4(child.matrixWorld);
      group.add(clone);
    }
  });

  if (!group.children.length) return new THREE.Scene();

  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  group.position.sub(center);

  const exportScene = new THREE.Scene();
  exportScene.add(group);
  return exportScene;
}

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
  inst.userData.slotIdx = slotIdx;
  inst.userData.objIdx = objIdx;
  slot.currentMesh = inst;
  scene.add(inst);
  renderSlots(slotPanel, state, selectObject);
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
  const objs = state.slots.map((s) => s.currentMesh).filter(Boolean);
  const intersect = raycaster.intersectObjects(objs, true)[0];
  let obj = intersect ? intersect.object : null;
  while (obj && obj.userData.slotIdx === undefined) obj = obj.parent;
  setHovered(obj);
}

function handleSceneClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const objs = state.slots.map((s) => s.currentMesh).filter(Boolean);
  const intersect = raycaster.intersectObjects(objs, true)[0];
  if (!intersect) return;
  let obj = intersect.object;
  while (obj && obj.userData.slotIdx === undefined) obj = obj.parent;
  if (!obj) return;
  const slotIdx = obj.userData.slotIdx;
  const objIdx = obj.userData.objIdx;
  const slot = state.slots[slotIdx];
  slot.selectedIndex = objIdx;
  slot.open = true;
  renderSlots(slotPanel, state, selectObject);
  const slotEl = slotPanel.children[slotIdx];
  if (slotEl) {
    slotEl.open = true;
    slotEl.scrollIntoView({ block: 'nearest' });
  }
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  pointerDown = { x: e.clientX, y: e.clientY };
  pointerMoved = false;
});

renderer.domElement.addEventListener('pointermove', (e) => {
  handleHover(e);
  if (!pointerDown) return;
  if (Math.abs(e.clientX - pointerDown.x) > 5 || Math.abs(e.clientY - pointerDown.y) > 5) {
    pointerMoved = true;
  }
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (e.button !== 0) return;
  if (!pointerMoved) handleSceneClick(e);
  handleHover(e);
  pointerDown = null;
});

renderer.domElement.addEventListener('pointerleave', () => {
  setHovered(null);
});

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
  const exportScene = buildExportScene(scene);
  if (!exportScene.children.length) return;

  if (isAndroid()) {
    const exporter = new GLTFExporter();
    const arrayBuffer = await exporter.parseAsync(exportScene, { binary: true });
    const base64 = arrayBufferToBase64(arrayBuffer);
    const dataUrl = `data:model/gltf-binary;base64,${base64}`;
    const intent =
      `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(dataUrl)}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;end;`;
    const win = window.open(intent, '_blank');
    if (win) win.focus();
  } else if (isIOS()) {
    const exporter = new USDZExporter();
    const arrayBuffer = await exporter.parseAsync(exportScene);
    const blob = new Blob([arrayBuffer], { type: 'model/vnd.usdz+zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.rel = 'ar';
    a.href = url;
    a.setAttribute('download', 'scene.usdz');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
