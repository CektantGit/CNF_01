import * as THREE from 'three';
import { OrbitControls } from 'OrbitControls';
import { GLTFLoader } from 'GLTFLoader';
import { RGBELoader } from 'RGBELoader';
import { viewInAR } from './ar.js';
import { ViewerState } from './viewer-state.js';
import { renderSlots, renderVariants } from './viewer-ui.js';
import { fetchObjectDetails } from './viewer-api.js';

const container = document.getElementById('viewerCanvas');
const slotPanel = document.getElementById('slotPanel');
const variantBar = document.getElementById('variantBar');
const slotsContainer = document.getElementById('slotsContainer');
const importBtn = document.getElementById('importBtn');
const importInput = document.getElementById('importInput');
const arBtn = document.getElementById('arBtn');
const stepNameEl = document.getElementById('stepName');
const prevStepBtn = document.getElementById('prevStep');
const nextStepBtn = document.getElementById('nextStep');
const stepControls = document.getElementById('stepControls');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.LinearToneMapping;
renderer.physicallyCorrectLights = true;
renderer.setClearColor(0xffffff, 1);
container.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
camera.position.set(0, 1, 3);
controls.update();
const defaultCamPos = camera.position.clone();
const defaultTarget = controls.target.clone();

const pmrem = new THREE.PMREMGenerator(renderer);
  new RGBELoader().load(
    'https://vizbl.com/hdr/neutral.hdr',
    (hdr) => {
      const envMap = pmrem.fromEquirectangular(hdr).texture;
    scene.environment = envMap;
    scene.background = new THREE.Color(0xffffff);
      hdr.dispose();
      pmrem.dispose();
    }
  );

const ambient = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambient);
const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
dirLight.position.set(5, 10, 7.5);
scene.add(dirLight);

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
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDown = null;
let pointerMoved = false;
let envMesh = null;
function applyViewPoint(){
  const vp = state.viewPoint;
  if(!vp.enabled){ resetViewPoint(); return; }
  controls.target.set(vp.position[0], vp.position[1], vp.position[2]);
  const offset = new THREE.Vector3(0,1,3);
  const euler = new THREE.Euler(
    THREE.MathUtils.degToRad(vp.rotation[0]),
    THREE.MathUtils.degToRad(vp.rotation[1]),
    THREE.MathUtils.degToRad(vp.rotation[2])
  );
  offset.applyEuler(euler);
  camera.position.set(vp.position[0]+offset.x, vp.position[1]+offset.y, vp.position[2]+offset.z);
  const sph = new THREE.Spherical().setFromVector3(offset);
  const basePolar = sph.phi;
  const baseAzimuth = sph.theta;
  if(vp.up>0) {
    controls.minPolarAngle = Math.max(0, basePolar - THREE.MathUtils.degToRad(vp.up));
  } else {
    controls.minPolarAngle = 0;
  }
  if(vp.down>0) {
    controls.maxPolarAngle = Math.min(Math.PI, basePolar + THREE.MathUtils.degToRad(vp.down));
  } else {
    controls.maxPolarAngle = Math.PI;
  }
  if(vp.left>0) {
    controls.minAzimuthAngle = baseAzimuth - THREE.MathUtils.degToRad(vp.left);
  } else {
    controls.minAzimuthAngle = -Infinity;
  }
  if(vp.right>0) {
    controls.maxAzimuthAngle = baseAzimuth + THREE.MathUtils.degToRad(vp.right);
  } else {
    controls.maxAzimuthAngle = Infinity;
  }
  controls.maxDistance = vp.maxDistance>0?vp.maxDistance:Infinity;
  controls.enablePan = vp.allowMovement;
  controls.update();
}

function resetViewPoint(){
  controls.target.copy(defaultTarget);
  camera.position.copy(defaultCamPos);
  controls.minPolarAngle=0;
  controls.maxPolarAngle=Math.PI;
  controls.minAzimuthAngle=-Infinity;
  controls.maxAzimuthAngle=Infinity;
  controls.maxDistance=Infinity;
  controls.enablePan=true;
  controls.update();
}

function renderUI(){
  renderVariants(variantBar, state, selectVariant);
  if(state.currentStep){
    const name = state.currentStep.name || `Step ${state.currentStepIndex + 1}`;
    stepNameEl.textContent = name;
  }else{
    stepNameEl.textContent = '';
  }
  stepControls.style.display = state.steps.length>1 ? 'flex' : 'none';
  renderSlots(slotsContainer, state, selectObject);
}

function showLoading(r, initial = false) {
  const overlay = document.getElementById('loadingOverlay');
  const bar = document.getElementById('progressBar');
  if (initial) overlay.classList.add('white');
  overlay.style.display = 'flex';
  bar.style.width = Math.floor(r * 100) + '%';
}
function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  overlay.style.display = 'none';
  overlay.classList.remove('white');
  document.getElementById('progressBar').style.width = '0';
}

async function loadMesh(obj, overlay = false) {
  if (obj.mesh) return obj.mesh;
  const mat = obj.materials[obj.selectedMaterial || 0];
  const url = mat?.native?.glbUrl;
  if (!url) return null;
  return await new Promise((resolve) => {
    if (overlay) showLoading(0);
    loader.load(
      url,
      (gltf) => {
        obj.mesh = gltf.scene;
        if (overlay) hideLoading();
        resolve(obj.mesh);
      },
      (evt) => {
        if (overlay && evt.total) showLoading(evt.loaded / evt.total);
      },
      (err) => {
        console.error(err);
        if (overlay) hideLoading();
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
    renderUI();
    return;
  }
  const obj = slot.objects[objIdx];
  if (typeof matIdx === 'number') obj.selectedMaterial = matIdx;
  obj.mesh = null; // force reload for new material
  const mesh = await loadMesh(obj, true);
  if (!mesh) {
    renderUI();
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
  renderUI();
}

async function loadAll(){
  if(envMesh){
    scene.remove(envMesh); envMesh=null;
  }
  state.slots.forEach(s=>{
    if(s.currentMesh){ scene.remove(s.currentMesh); s.currentMesh=null; }
  });

  const slotsToLoad = state.slots.filter(s=>s.selectedIndex>=0);
  const total = (state.environment?1:0) + slotsToLoad.length;
  let loaded = 0;
  if(total>0) showLoading(0, true);

  if(state.environment){
    const mat=state.environment.materials[state.environment.selectedMaterial];
    const url=mat?.native?.glbUrl;
    if(url){
      await new Promise((resolve)=>{
        loader.load(url,(gltf)=>{envMesh=gltf.scene;resolve();},undefined,()=>resolve());
      });
      if(envMesh){
        envMesh.traverse(ch=>{
          if(ch.isMesh){
            ch.castShadow=false; ch.receiveShadow=false;
            const m=ch.material;
            ch.material=new THREE.MeshBasicMaterial({
              map:m.map, aoMap:m.aoMap, aoMapIntensity:m.aoMapIntensity,
              color:m.color?.clone(), transparent:m.transparent, opacity:m.opacity, side:m.side
            });
          }
        });
        envMesh.position.fromArray(state.environment.transform.position);
        envMesh.rotation.set(...state.environment.transform.rotation.map(r=>THREE.MathUtils.degToRad(r)));
        envMesh.scale.fromArray(state.environment.transform.scale);
        scene.add(envMesh);
        envMesh.updateWorldMatrix(true, true);
      }
    }
    loaded++;
    showLoading(loaded/total);
  }

  for(const slot of slotsToLoad){
    const obj = slot.objects[slot.selectedIndex];
    const mesh = await loadMesh(obj, false);
    loaded++;
    showLoading(loaded/total);
    if(mesh){
      const inst = mesh.clone();
      inst.position.fromArray(obj.transform.position);
      inst.rotation.set(...obj.transform.rotation.map(r=>THREE.MathUtils.degToRad(r)));
      inst.scale.fromArray(obj.transform.scale);
      inst.userData.slotIdx = state.slots.indexOf(slot);
      inst.userData.objIdx = slot.selectedIndex;
      slot.currentMesh = inst;
      scene.add(inst);
    }
  }
  hideLoading();
  renderUI();
}

async function selectVariant(idx){
  if(idx===state.currentVariantIndex) return;
  state.slots.forEach(s=>{
    if(s.currentMesh){scene.remove(s.currentMesh); s.currentMesh=null;}
  });
  state.setVariant(idx);
  await loadAll();
  if(state.viewPoint.enabled) applyViewPoint(); else resetViewPoint();
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
    renderUI();
    const slotEl = slotsContainer.children[state.slots.indexOf(slot)];
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
  if (!pointerDown) return;
  if (Math.abs(e.clientX - pointerDown.x) > 5 || Math.abs(e.clientY - pointerDown.y) > 5) {
    pointerMoved = true;
  }
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (e.button !== 0) return;
  if (!pointerMoved) handleSceneClick(e);
  pointerDown = null;
});

async function handleImport(file) {
  showLoading(0, true);
  const text = await file.text();
  const data = JSON.parse(text);
  state.slots.forEach((s) => {
    if (s.currentMesh) {
      scene.remove(s.currentMesh);
      s.currentMesh = null;
    }
  });
  await state.loadConfig(data, fetchObjectDetails);
  await loadAll();
  if(state.viewPoint.enabled) applyViewPoint(); else resetViewPoint();
}

importBtn.addEventListener('click', () => importInput.click());
importInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleImport(file);
});

prevStepBtn.addEventListener('click',()=>{
  state.currentStepIndex = (state.currentStepIndex - 1 + state.steps.length) % state.steps.length;
  renderUI();
});
nextStepBtn.addEventListener('click',()=>{
  state.currentStepIndex = (state.currentStepIndex + 1) % state.steps.length;
  renderUI();
});

arBtn.addEventListener('click', async () => {
  let removedEnv = false;
  if (envMesh) {
    scene.remove(envMesh);
    removedEnv = true;
  }
  await viewInAR(scene);
  if (removedEnv && envMesh) scene.add(envMesh);
});
