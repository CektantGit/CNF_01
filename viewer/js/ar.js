import * as THREE from 'three';
import { GLTFExporter } from 'GLTFExporter';
import { USDZExporter } from 'USDZExporter';

// Export the current scene and launch model-viewer's AR mode.
export async function viewInAR(scene) {
  const exportScene = new THREE.Group();
  scene.updateMatrixWorld(true);

  // Clone all meshes with world transforms and strip extra attributes.
  scene.traverse(obj => {
    if (!obj.isMesh) return;
    if (obj.userData.isEnv) return;

    const toStandard = m => {
      if (m.isMeshStandardMaterial) {
        const mat = m.clone();
        mat.side = THREE.FrontSide;
        return mat;
      }
      const params = { color: m.color };
      if (m.map) params.map = m.map;
      if (m.normalMap) params.normalMap = m.normalMap;
      if (m.roughnessMap) params.roughnessMap = m.roughnessMap;
      if (m.metalnessMap) params.metalnessMap = m.metalnessMap;
      const mat = new THREE.MeshStandardMaterial(params);
      mat.side = THREE.FrontSide;
      return mat;
    };

    let baseMat;
    if (Array.isArray(obj.material)) {
      baseMat = obj.material.find(m => m.isMeshStandardMaterial) || obj.material[0];
    } else {
      baseMat = obj.material;
    }
    const material = toStandard(baseMat);

    const geom = obj.geometry.clone();
    geom.applyMatrix4(obj.matrixWorld);

    if (!geom.attributes.normal) geom.computeVertexNormals();
    if (!geom.attributes.uv) {
      const count = geom.attributes.position.count;
      geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    for (const name of Object.keys(geom.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') {
        geom.deleteAttribute(name);
      }
    }
    geom.morphAttributes = {};

    const mesh = new THREE.Mesh(geom, material);
    mesh.matrixAutoUpdate = false;
    exportScene.add(mesh);
  });

  if (exportScene.children.length === 0) return;

  const exporter = new GLTFExporter();
  const glbBuffer = await exporter.parseAsync(exportScene, { binary: true });
  const glbBlob = new Blob([glbBuffer], { type: 'model/gltf-binary' });

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    const usdzExporter = new USDZExporter();
    const arraybuffer = await usdzExporter.parseAsync(exportScene);
    if (arraybuffer) {
      const usdzFile = new File([arraybuffer], 'scene.usdz', {
        type: 'model/vnd.usdz+zip'
      });
      const link = document.createElement('a');
      link.rel = 'ar';
      link.href = URL.createObjectURL(usdzFile);
      link.click();
    } else {
      console.error('USDZExporter returned null.');
    }
    return;
  }

  const modelViewer = document.getElementById('ar-viewer');
  if (!modelViewer) {
    console.error('AR viewer element not found');
    return;
  }
  const glbUrl = URL.createObjectURL(glbBlob);
  modelViewer.setAttribute('src', glbUrl);

  // Wait for the model to finish loading before triggering AR.
  await modelViewer.updateComplete;
  modelViewer.activateAR();
}
