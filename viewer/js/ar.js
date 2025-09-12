import * as THREE from 'three';
import { GLTFExporter } from 'GLTFExporter';
import { USDZExporter } from 'USDZExporter';

function fixTexture(tex) {
  if (!tex) return null;
  const img = tex.image;
  if (
    img instanceof HTMLImageElement ||
    img instanceof HTMLCanvasElement ||
    img instanceof ImageBitmap ||
    img instanceof OffscreenCanvas
  ) {
    return tex;
  }
  if (img && img.data && img.width && img.height) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    const data = img.data.buffer ? new Uint8ClampedArray(img.data.buffer) : img.data;
    const imageData = new ImageData(data, img.width, img.height);
    ctx.putImageData(imageData, 0, 0);
    const ctex = new THREE.CanvasTexture(canvas);
    ctex.flipY = tex.flipY;
    ctex.wrapS = tex.wrapS;
    ctex.wrapT = tex.wrapT;
    ctex.repeat.copy(tex.repeat);
    ctex.offset.copy(tex.offset);
    return ctex;
  }
  return null;
}

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
        mat.envMap = null;
        ['map', 'normalMap', 'roughnessMap', 'metalnessMap'].forEach(k => {
          if (mat[k]) {
            const fixed = fixTexture(mat[k]);
            if (fixed) mat[k] = fixed; else delete mat[k];
          }
        });
        return mat;
      }
      const params = { color: m.color };
      if (m.map) {
        const t = fixTexture(m.map); if (t) params.map = t;
      }
      if (m.normalMap) {
        const t = fixTexture(m.normalMap); if (t) params.normalMap = t;
      }
      if (m.roughnessMap) {
        const t = fixTexture(m.roughnessMap); if (t) params.roughnessMap = t;
      }
      if (m.metalnessMap) {
        const t = fixTexture(m.metalnessMap); if (t) params.metalnessMap = t;
      }
      const mat = new THREE.MeshStandardMaterial(params);
      mat.side = THREE.FrontSide;
      mat.envMap = null;
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

  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);

  if (isIOS) {
    try {
      const usdzExporter = new USDZExporter();
      const arraybuffer = await usdzExporter.parseAsync(exportScene);
      if (arraybuffer) {
        const usdzFile = new File([arraybuffer], 'scene.usdz', {
          type: 'model/vnd.usdz+zip'
        });
        const usdzUrl = URL.createObjectURL(usdzFile);
        const link = document.createElement('a');
        link.setAttribute('rel', 'ar');
        link.href = usdzUrl + '#allowsContentScaling=0';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(usdzUrl), 10000);
      }
    } catch (err) {
      console.error('USDZ export failed', err);
    }
    return;
  }

  const exporter = new GLTFExporter();
  const glbBuffer = await exporter.parseAsync(exportScene, { binary: true });
  const glbBlob = new Blob([glbBuffer], { type: 'model/gltf-binary' });

  if (isAndroid) {
    const modelViewer = document.getElementById('ar-viewer');
    if (!modelViewer) return;
    const glbUrl = URL.createObjectURL(glbBlob);
    const onLoad = () => {
      modelViewer.removeEventListener('load', onLoad);
      modelViewer.activateAR();
      setTimeout(() => URL.revokeObjectURL(glbUrl), 10000);
    };
    modelViewer.addEventListener('load', onLoad, { once: true });
    modelViewer.setAttribute('src', glbUrl);
    return;
  }

  const link = document.createElement('a');
  link.href = URL.createObjectURL(glbBlob);
  link.download = 'scene.glb';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
