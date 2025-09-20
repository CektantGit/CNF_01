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
import { openObjectModal } from './modal.js';
import { fetchObjectDetails } from './api.js';

const state = new ConfiguratorState();

const slotListEl = document.getElementById('slots');
const variantListEl = document.getElementById('variantList');
const addVariantBtn = document.getElementById('addVariant');
const delVariantBtn = document.getElementById('delVariant');
const renVariantBtn = document.getElementById('renVariant');
const addSlotBtn = document.getElementById('addSlotBtn');
const prevStepBtn = document.getElementById('prevStep');
const nextStepBtn = document.getElementById('nextStep');
const stepNameEl = document.getElementById('stepName');
const stepControls = document.getElementById('stepControls');
const stepsListEl = document.getElementById('stepsList');
const addStepBtn = document.getElementById('addStep');
const addObjectBtn = document.getElementById('addObjectBtn');
const inheritBtn = document.getElementById('inheritBtn');
const objectsContainer = document.getElementById('objects');
const objectActionsRow = document.getElementById('objectActions');
const slotOptionsRow = document.getElementById('slotOptions');
const slotDetailSection = document.getElementById('slotDetail');
const canBeEmptyChk = document.getElementById('canBeEmpty');
const textButtonsChk = document.getElementById('textButtons');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importInput = document.getElementById('importInput');
const viewToggleBtn = document.getElementById('viewToggle');
const modalEl = document.getElementById('objectModal');
const moveBtn = document.getElementById('moveBtn');
const rotateBtn = document.getElementById('rotateBtn');
const scaleBtn = document.getElementById('scaleBtn');
const noneBtn = document.getElementById('noneBtn');
const gridBtn = document.getElementById('gridBtn');
const outlineBtn = document.getElementById('outlineBtn');
const coordsPanel = document.getElementById('coordsPanel');
const coordX = document.getElementById('coordX');
const coordY = document.getElementById('coordY');
const coordZ = document.getElementById('coordZ');
const loadingOverlay = document.getElementById('loadingOverlay');
const progressBar = document.getElementById('progressBar');
const lockBtn = document.getElementById('lockBtn');
const envUuidInput = document.getElementById('envUuid');
const loadEnvBtn = document.getElementById('loadEnv');
const removeEnvBtn = document.getElementById('removeEnv');
const envInfoEl = document.getElementById('envInfo');
const viewEnabled = document.getElementById('viewEnabled');
const viewLeft = document.getElementById('viewLeft');
const viewRight = document.getElementById('viewRight');
const viewDown = document.getElementById('viewDown');
const viewUp = document.getElementById('viewUp');
const viewMinDist = document.getElementById('viewMinDist');
const viewDist = document.getElementById('viewDist');
const tabButtons = Array.from(document.querySelectorAll('#tabButtons .tab-button'));
const panels = {
  slot: document.getElementById('panel-slot'),
  env: document.getElementById('panel-env'),
  cam: document.getElementById('panel-cam'),
  world: document.getElementById('panel-world')
};

outlineBtn.classList.add('active');
const slotTabButton = tabButtons.find(btn => btn.dataset.tab === 'slot');

let activeTab = 'slot';
function setActiveTab(tab) {
  if (!panels[tab]) return;
  if (tab === 'slot' && slotTabButton?.disabled) return;
  activeTab = tab;
  tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  Object.entries(panels).forEach(([key, panel]) => {
    panel.classList.toggle('active', key === tab);
  });
}
function updateSlotTabState() {
  if (!slotTabButton) return;
  const hasSlotSelected = state.currentSlotIndex !== -1 && !!state.currentSlot;
  slotTabButton.disabled = !hasSlotSelected;
  if (slotTabButton.disabled && activeTab === 'slot') {
    if (panels.env) {
      setActiveTab('env');
    } else {
      const fallback = Object.keys(panels).find(key => key !== 'slot');
      if (fallback) setActiveTab(fallback);
    }
  }
}
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    setActiveTab(btn.dataset.tab);
  });
});
setActiveTab('slot');

let variantEditIndex = null;

// THREE.js setup
const viewer = document.getElementById('viewer');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.LinearToneMapping;
renderer.physicallyCorrectLights = true;
renderer.setClearColor(0xffffff, 1);
viewer.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
new RGBELoader().load(
  'https://vizbl.com/hdr/neutral.hdr',
  (hdr) => {
    const envMap = pmrem.fromEquirectangular(hdr).texture;
    scene.environment = envMap;
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

const defaultCamPos = camera.position.clone();
const defaultTarget = orbit.target.clone();
let viewPreview = false;

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
outlinePass.edgeThickness = 12;
outlinePass.visibleEdgeColor.set(0x888888);
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

const viewPivot = new THREE.Mesh(new THREE.SphereGeometry(0.05), new THREE.MeshBasicMaterial({color:0xff0000}));
viewPivot.userData.view = true;
scene.add(viewPivot);
viewPivot.position.fromArray(state.viewPoint.position);
viewPivot.rotation.set(
  THREE.MathUtils.degToRad(state.viewPoint.rotation[0]),
  THREE.MathUtils.degToRad(state.viewPoint.rotation[1]),
  THREE.MathUtils.degToRad(state.viewPoint.rotation[2])
);

function applyViewPreview(){
  const vp = state.viewPoint;
  orbit.target.set(vp.position[0], vp.position[1], vp.position[2]);
  const offset = new THREE.Vector3(0,1,3);
  const euler = new THREE.Euler(
    THREE.MathUtils.degToRad(vp.rotation[0]),
    THREE.MathUtils.degToRad(vp.rotation[1]),
    THREE.MathUtils.degToRad(vp.rotation[2])
  );
  offset.applyEuler(euler);
  camera.position.set(
    vp.position[0] + offset.x,
    vp.position[1] + offset.y,
    vp.position[2] + offset.z
  );
  const sph = new THREE.Spherical().setFromVector3(offset);
  const basePolar = sph.phi;
  const baseAzimuth = sph.theta;
  if(vp.up>0) {
    orbit.minPolarAngle = Math.max(0, basePolar - THREE.MathUtils.degToRad(vp.up));
  } else {
    orbit.minPolarAngle = 0;
  }
  if(vp.down>0) {
    orbit.maxPolarAngle = Math.min(Math.PI, basePolar + THREE.MathUtils.degToRad(vp.down));
  } else {
    orbit.maxPolarAngle = Math.PI;
  }
  if(vp.left>0) {
    orbit.minAzimuthAngle = baseAzimuth - THREE.MathUtils.degToRad(vp.left);
  } else {
    orbit.minAzimuthAngle = -Infinity;
  }
  if(vp.right>0) {
    orbit.maxAzimuthAngle = baseAzimuth + THREE.MathUtils.degToRad(vp.right);
  } else {
    orbit.maxAzimuthAngle = Infinity;
  }
  orbit.minDistance = vp.minDistance>0 ? vp.minDistance : 0;
  orbit.maxDistance = vp.maxDistance>0 ? vp.maxDistance : Infinity;
  orbit.enablePan = false;
  orbit.update();
}

function resetViewPreview(){
  orbit.target.copy(defaultTarget);
  camera.position.copy(defaultCamPos);
  orbit.minPolarAngle=0;
  orbit.maxPolarAngle=Math.PI;
  orbit.minAzimuthAngle=-Infinity;
  orbit.maxAzimuthAngle=Infinity;
  orbit.minDistance=0;
  orbit.maxDistance=Infinity;
  orbit.enablePan=true;
  orbit.update();
}

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
let envMesh = null;
let envLocked = true;
let transformMode = null;

const axisNames = ['x','y','z'];

function updatePanels(){
  const hasSlot = state.currentSlotIndex !== -1 && !!state.currentSlot;
  objectActionsRow.style.display = hasSlot ? 'flex' : 'none';
  slotOptionsRow.style.display = hasSlot ? 'flex' : 'none';
  if (slotDetailSection) {
    slotDetailSection.style.display = hasSlot && !isMobile() ? 'flex' : 'none';
  }
  if (!hasSlot) {
    objectsContainer.innerHTML = '';
  }
}

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
  } else if (transformMode === 'scale') {
    coordX.value = transform.object.scale.x.toFixed(2);
    coordY.value = transform.object.scale.y.toFixed(2);
    coordZ.value = transform.object.scale.z.toFixed(2);
  }
}

[coordX, coordY, coordZ].forEach((input, idx) => {
  input.addEventListener('focus', () => input.select());
  input.addEventListener('change', () => {
    if (!transform.object) return;
    const val = parseFloat(input.value);
    if (isNaN(val)) return;
    if(transform.object === viewPivot){
      if(transformMode === 'translate'){
        viewPivot.position[axisNames[idx]] = val;
        state.viewPoint.position[idx] = val;
      }else if(transformMode === 'rotate'){
        const rad = THREE.MathUtils.degToRad(val);
        viewPivot.rotation[axisNames[idx]] = rad;
        state.viewPoint.rotation[idx] = val;
      }
    } else {
      const obj = transform.object.userData.stateObj || transform.object.userData.envObj;
      if (transformMode === 'translate') {
        transform.object.position[axisNames[idx]] = val;
        obj.transform.position[idx] = val;
      } else if (transformMode === 'rotate') {
        const rad = THREE.MathUtils.degToRad(val);
        transform.object.rotation[axisNames[idx]] = rad;
        obj.transform.rotation[idx] = val;
      } else if (transformMode === 'scale') {
        transform.object.scale[axisNames[idx]] = val;
        obj.transform.scale[idx] = val;
      }
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

function loadEnvironment(env){
  if(envMesh){
    if(transform.object===envMesh) transform.detach();
    scene.remove(envMesh);
    envMesh=null;
  }
  if(!env) { setHovered(hovered); updateCoordInputs(); return; }
  const mat = env.materials[env.selectedMaterial];
  const url = mat?.native?.glbUrl;
  if(!url) return;
  const loadId = crypto.randomUUID();
  env._loadId = loadId;
  showLoading();
  loader.load(url, gltf=>{
    if(env._loadId!==loadId){hideLoading();return;}
    envMesh=gltf.scene;
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
    envMesh.position.fromArray(env.transform.position);
    envMesh.rotation.set(
      THREE.MathUtils.degToRad(env.transform.rotation[0]),
      THREE.MathUtils.degToRad(env.transform.rotation[1]),
      THREE.MathUtils.degToRad(env.transform.rotation[2])
    );
    envMesh.scale.fromArray(env.transform.scale);
    envMesh.userData.envObj = env;
    scene.add(envMesh);
    setHovered(hovered && hovered.userData.envObj ? null : hovered);
    if(transformMode!==null && state.currentSlotIndex===-1 && !envLocked) transform.attach(envMesh); else transform.detach();
    hideLoading();
  },xhr=>{ if(xhr.total) updateLoading(xhr.loaded/xhr.total); },err=>{console.error(err);hideLoading();});
}

function reloadScene(){
  Object.values(meshes).forEach(m=>{ if(transform.object===m) transform.detach(); scene.remove(m);});
  Object.keys(meshes).forEach(k=>delete meshes[k]);
  if(envMesh){
    if(transform.object===envMesh) transform.detach();
    scene.remove(envMesh); envMesh=null;
  }
  if(state.environment) loadEnvironment(state.environment);
  state.slots.forEach((slot,idx)=>loadSlot(slot, idx===state.currentSlotIndex));
  viewPivot.position.fromArray(state.viewPoint.position);
  viewPivot.rotation.set(
    THREE.MathUtils.degToRad(state.viewPoint.rotation[0]),
    THREE.MathUtils.degToRad(state.viewPoint.rotation[1]),
    THREE.MathUtils.degToRad(state.viewPoint.rotation[2])
  );
  viewPivot.visible = !state.viewPoint.hidden;
  if(viewPreview) applyViewPreview();
}

function renderVariants(){
  if(!variantListEl) return;
  variantListEl.innerHTML='';
  if(variantEditIndex!=null && variantEditIndex>=state.variants.length){
    variantEditIndex = null;
  }
  state.variants.forEach((variant,index)=>{
    const row=document.createElement('div');
    row.className='variant-row'+(index===state.currentVariantIndex?' selected':'');
    if(variantEditIndex===index){
      const input=document.createElement('input');
      input.type='text';
      input.value=variant.name;
      const commit=()=>{
        const value=input.value.trim();
        if(!value){
          input.value=variant.name;
          input.focus();
          input.select();
          return;
        }
        variant.name=value;
        variantEditIndex=null;
        renderVariants();
      };
      input.addEventListener('blur',commit);
      input.addEventListener('keydown',e=>{
        if(e.key==='Enter'){ commit(); }
        if(e.key==='Escape'){ variantEditIndex=null; renderVariants(); }
      });
      row.appendChild(input);
      setTimeout(()=>{ input.focus(); input.select(); },0);
    }else{
      const name=document.createElement('span');
      name.textContent=variant.name;
      row.appendChild(name);
    }
    row.addEventListener('click',()=>{
      if(variantEditIndex===index) return;
      if(state.currentVariantIndex===index) return;
      state.currentVariantIndex=index;
      state.currentSlotIndex=-1;
      state.currentStepIndex=0;
      renderUI();
      reloadScene();
    });
    variantListEl.appendChild(row);
  });
  delVariantBtn.disabled = state.variants.length <= 1;
}

function renderStepsEditor(){
  if(!stepsListEl) return;
  stepsListEl.innerHTML='';
  state.steps.forEach((step, stepIndex)=>{
    const row=document.createElement('div');
    row.className='step-row';
    const header=document.createElement('div');
    header.className='step-header';
    const nameInput=document.createElement('input');
    nameInput.type='text';
    nameInput.value=step.name;
    nameInput.addEventListener('change',()=>{
      const value=nameInput.value.trim();
      if(!value){
        nameInput.value = step.name;
        return;
      }
      step.name = value;
      if(stepIndex===state.currentStepIndex){
        stepNameEl.textContent = step.name;
      }
    });
    header.appendChild(nameInput);
    const delBtn=document.createElement('button');
    delBtn.textContent='Delete';
    delBtn.className='action-btn';
    delBtn.disabled = state.steps.length <= 1;
    delBtn.addEventListener('click',()=>{
      if(state.steps.length<=1) return;
      const removed = state.steps.splice(stepIndex,1)[0];
      state.slots.forEach(s=>{ if(s.stepId===removed.id) s.stepId = state.steps[0].id; });
      if(state.currentStepIndex>=state.steps.length) state.currentStepIndex=0;
      renderUI();
    });
    header.appendChild(delBtn);
    row.appendChild(header);
    const checks=document.createElement('div');
    checks.className='slot-checks';
    state.slots.forEach(slot=>{
      const label=document.createElement('label');
      const chk=document.createElement('input');
      chk.type='checkbox';
      chk.checked = slot.stepId === step.id;
      chk.addEventListener('change',()=>{
        if(chk.checked){
          slot.stepId = step.id;
        }else if(slot.stepId === step.id){
          slot.stepId = state.steps[0]?.id || step.id;
        }
        renderUI();
      });
      label.appendChild(chk);
      label.appendChild(document.createTextNode(slot.name));
      checks.appendChild(label);
    });
    row.appendChild(checks);
    stepsListEl.appendChild(row);
  });
}

function syncCameraPanel(){
  if(!viewEnabled) return;
  viewEnabled.checked = !!state.viewPoint.enabled;
  if(viewLeft) viewLeft.value = state.viewPoint.left ?? 0;
  if(viewRight) viewRight.value = state.viewPoint.right ?? 0;
  if(viewDown) viewDown.value = state.viewPoint.down ?? 0;
  if(viewUp) viewUp.value = state.viewPoint.up ?? 0;
  if(viewMinDist) viewMinDist.value = state.viewPoint.minDistance ?? 0;
  if(viewDist) viewDist.value = state.viewPoint.maxDistance ?? 0;
}

function syncEnvironmentPanel(){
  if(envUuidInput) envUuidInput.value = state.environment?.uuid || '';
  if(envInfoEl){
    if(state.environment){
      envInfoEl.textContent = state.environment.name || state.environment.uuid || '';
    }else{
      envInfoEl.textContent = 'No environment loaded';
    }
  }
  lockBtn.classList.toggle('active', envLocked);
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
  if(transform.object===viewPivot){
    state.viewPoint.position = [viewPivot.position.x, viewPivot.position.y, viewPivot.position.z];
    state.viewPoint.rotation = [
      THREE.MathUtils.radToDeg(viewPivot.rotation.x),
      THREE.MathUtils.radToDeg(viewPivot.rotation.y),
      THREE.MathUtils.radToDeg(viewPivot.rotation.z)
    ];
    if(viewPreview) applyViewPreview();
  } else {
    const obj = transform.object?.userData?.stateObj || transform.object?.userData?.envObj;
    if (!obj) return;
    obj.transform.position = [transform.object.position.x, transform.object.position.y, transform.object.position.z];
    obj.transform.rotation = [
      THREE.MathUtils.radToDeg(transform.object.rotation.x),
      THREE.MathUtils.radToDeg(transform.object.rotation.y),
      THREE.MathUtils.radToDeg(transform.object.rotation.z)
    ];
    obj.transform.scale = [transform.object.scale.x, transform.object.scale.y, transform.object.scale.z];
  }
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
  if (!slot) {
    if (transformMode !== null) {
      transform.attach(viewPivot);
      transform.enabled = true;
    } else {
      transform.detach();
    }
    updateCoordInputs();
    return;
  }
  if (slot.selectedObjectIndex === -1 || slot.hidden) {
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
  const objs = [...Object.values(meshes), viewPivot];
  if(envMesh && !envLocked) objs.push(envMesh);
  const intersect = raycaster.intersectObjects(objs, true)[0];
  let obj = intersect ? intersect.object : null;
  while (obj && !obj.userData.slotId && !obj.userData.envObj) obj = obj.parent;
  setHovered(obj && obj.userData.envObj ? null : obj);
}

function handleSceneClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const objs2 = [...Object.values(meshes), viewPivot];
  if(envMesh && !envLocked) objs2.push(envMesh);
  const intersect = raycaster.intersectObjects(objs2, true)[0];
  if (!intersect) return;
  let obj = intersect.object;
  if(obj === viewPivot){
    state.currentSlotIndex = -1;
    renderUI();
    if(transformMode!==null) transform.attach(viewPivot); else transform.detach();
    transform.enabled = transformMode !== null;
    updateCoordInputs();
    return;
  }
  while (obj && !obj.userData.slotId && !obj.userData.envObj) obj = obj.parent;
  if (!obj) return;
  if(obj.userData.envObj){
    if(envLocked) return;
    state.currentSlotIndex = -1;
    renderUI();
    if(transformMode!==null) transform.attach(envMesh); else transform.detach();
    transform.enabled = transformMode !== null;
    updateCoordInputs();
    return;
  }
  const slotIndex = state.slots.findIndex(s => s.id === obj.userData.slotId);
  if (slotIndex === -1) return;
  const slot = state.slots[slotIndex];
  const objIdx = slot.objects.indexOf(obj.userData.stateObj);
  if (objIdx !== -1) slot.selectedObjectIndex = objIdx;
  slotCallbacks.onSelect(slotIndex);
}

// UI callbacks
function selectSlot(index){
  if(index==='view'){
    state.currentSlotIndex = -1;
    renderUI();
    activateSlot(null);
    return;
  }
  if(typeof index!=='number' || !state.slots[index]) return;
  state.currentSlotIndex = index;
  const stepIdx = state.steps.findIndex(st=>st.id===state.slots[index]?.stepId);
  if(stepIdx!==-1) state.currentStepIndex = stepIdx;
  renderUI();
  if (activeTab !== 'slot') setActiveTab('slot');
  activateSlot(state.currentSlot);
  const el = slotListEl.children[state.slots.filter(s=>s.stepId===state.currentStep.id).indexOf(state.currentSlot)+1];
  if (el) el.scrollIntoView({ block: 'nearest' });
}

const slotCallbacks = {
  onSelect: selectSlot,
  onDelete(id) {
    const mesh = meshes[id];
    if (mesh) {
      if (transform.object === mesh) transform.detach();
      scene.remove(mesh);
      delete meshes[id];
    }
    state.removeSlot(id);
    renderUI();
    if(state.currentSlotIndex===-1) activateSlot(null); else activateSlot(state.currentSlot);
  },
  onToggleHide(slot) {
    if(slot==='view'){
      state.viewPoint.hidden = !state.viewPoint.hidden;
      viewPivot.visible = !state.viewPoint.hidden;
      renderUI();
      return;
    }
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
  const slot = state.addSlot();
  renderUI();
  canBeEmptyChk.checked = state.currentSlot?.canBeEmpty || false;
  if(slot.selectedObjectIndex !== -1) loadSlot(slot, true);
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

importBtn.addEventListener('click', () => importInput && importInput.click());
importInput && importInput.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await handleImport(data);
  } catch (err) {
    console.error('Import failed', err);
  }
  if (importInput) importInput.value = '';
});

viewToggleBtn.addEventListener('click',()=>{
  viewPreview = !viewPreview;
  viewToggleBtn.classList.toggle('active', viewPreview);
  if(viewPreview) applyViewPreview(); else resetViewPreview();
});

function changeStep(delta){
  const len = state.steps.length;
  state.currentStepIndex = (state.currentStepIndex + delta + len) % len;
  const stepId = state.currentStep.id;
  const idx = state.slots.findIndex(s=>s.stepId===stepId);
  state.currentSlotIndex = idx;
  renderUI();
}

prevStepBtn.addEventListener('click',()=>changeStep(-1));
nextStepBtn.addEventListener('click',()=>changeStep(1));

addVariantBtn.addEventListener('click',()=>{
  state.addVariant();
  variantEditIndex = state.currentVariantIndex;
  renderUI();
  reloadScene();
});
delVariantBtn.addEventListener('click',()=>{
  state.deleteCurrentVariant();
  variantEditIndex = null;
  renderUI();
  reloadScene();
});
renVariantBtn.addEventListener('click',()=>{
  if(state.variants.length===0) return;
  variantEditIndex = state.currentVariantIndex;
  renderVariants();
});

lockBtn.addEventListener('click',()=>{
  envLocked = !envLocked;
  if(envLocked && transform.object===envMesh) transform.detach();
  if(!envLocked && envMesh && state.currentSlotIndex===-1 && transformMode!==null) transform.attach(envMesh);
  updateCoordInputs();
  syncEnvironmentPanel();
});
loadEnvBtn.addEventListener('click',async()=>{
  const uuid=envUuidInput.value.trim(); if(!uuid) return;
  const details=await fetchObjectDetails(uuid); if(!details) return;
  const env={uuid,name:details.name,materials:details.materials||[],selectedMaterial:0,transform:{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}};
  state.setEnvironment(env);
  loadEnvironment(env);
  syncEnvironmentPanel();
});
removeEnvBtn.addEventListener('click',()=>{
  state.removeEnvironment();
  if(envMesh){
    if(transform.object===envMesh) transform.detach();
    scene.remove(envMesh); envMesh=null;
  }
  setHovered(hovered && hovered.userData?.envObj ? null : hovered);
  updateCoordInputs();
  syncEnvironmentPanel();
});

addStepBtn?.addEventListener('click',()=>{
  state.addStep(`Step ${state.steps.length + 1}`);
  renderUI();
});

viewEnabled?.addEventListener('change',()=>{
  state.viewPoint.enabled = viewEnabled.checked;
  if(viewPreview) applyViewPreview();
});
[
  { el: viewLeft, prop: 'left' },
  { el: viewRight, prop: 'right' },
  { el: viewDown, prop: 'down' },
  { el: viewUp, prop: 'up' },
  { el: viewMinDist, prop: 'minDistance' },
  { el: viewDist, prop: 'maxDistance' }
].forEach(({el, prop})=>{
  el?.addEventListener('change',()=>{
    const val = parseFloat(el.value);
    state.viewPoint[prop] = isNaN(val) ? 0 : val;
    if(viewPreview) applyViewPreview();
  });
});

function updateTransformButtons() {
  moveBtn.classList.toggle('active', transformMode === 'translate');
  rotateBtn.classList.toggle('active', transformMode === 'rotate');
  scaleBtn.classList.toggle('active', transformMode === 'scale');
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
scaleBtn.addEventListener('click', () => setTransformMode('scale'));
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

textButtonsChk.addEventListener('change', () => {
  const slot = state.currentSlot;
  if (slot) slot.textButtons = textButtonsChk.checked;
});

async function handleImport(data) {
  reloadScene();
  setTransformMode(null);
  await state.importJSON(data, fetchObjectDetails);
  variantEditIndex = null;
  renderUI();
  canBeEmptyChk.checked = state.currentSlot?.canBeEmpty || false;
  textButtonsChk.checked = state.currentSlot?.textButtons || false;
  reloadScene();
}

// initialize
state.addSlot();

function renderUI(){
  if(state.currentStepIndex>=state.steps.length) state.currentStepIndex = 0;
  const step = state.currentStep;
  state.steps.forEach((s,i)=>{ s.index = i; });
  stepNameEl.textContent = step.name;
  stepControls.style.display = state.steps.length>1 ? 'flex' : 'none';
  renderVariants();
  renderStepsEditor();
  if(state.currentSlotIndex !== -1 && state.currentSlot?.stepId !== step.id){
    const idx = state.slots.findIndex(s=>s.stepId===step.id);
    state.currentSlotIndex = idx;
  }
  if(isMobile()){
    if(slotDetailSection) slotDetailSection.style.display='none';
    renderSlotsMobile(state, slotListEl, slotCallbacks, objectCallbacks, step.id);
  }else{
    if(slotDetailSection) slotDetailSection.style.display='flex';
    renderSlots(state, slotListEl, slotCallbacks, step.id);
    renderObjects(state.currentSlot, objectsContainer, objectCallbacks);
  }
  canBeEmptyChk.checked = state.currentSlot?.canBeEmpty || false;
  textButtonsChk.checked = state.currentSlot?.textButtons || false;
  updatePanels();
  syncCameraPanel();
  syncEnvironmentPanel();
  updateSlotTabState();
}

renderUI();
canBeEmptyChk.checked = state.currentSlot?.canBeEmpty || false;
textButtonsChk.checked = state.currentSlot?.textButtons || false;
activateSlot(state.currentSlot);
updateTransformButtons();
reloadScene();
