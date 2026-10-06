import * as THREE from 'three';
import { RectAreaLightHelper } from 'three/addons/helpers/RectAreaLightHelper.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import type { ImFusion, GlViewState } from '@imfusion/sdk';

/**
 * three.js custom rendering for the ImFusion Web SDK.
 */
export default async function setup(imf: ImFusion) {
  const data = await imf.loadFileFromUrl(new URL('../example_data/CT/img.imf', import.meta.url).href);
  imf.showAll(data);

  // This demo animates every frame, so it drives rendering itself: take over from
  // the SDK's auto-render and run our own loop below (restored on cleanup).
  imf.pauseAutoRender();

  // Show the volume view on its own, filling the canvas (restored on cleanup).
  imf.display.layouter().setMaximizedView(imf.display.main3dView());

  const cam = imf.bindings.Camera.fromVectors([49.51, -499.89, -175.04], [-0.18, 0.98, -0.11], [0.0, 0.11, 0.99]);
  cam.fovY = 40;
  imf.display.main3dView().setCamera(cam, true); // suppressAnimation: snap to the pose
  cam.delete();

  const renderer = new THREE.WebGLRenderer({
    context: imf.canvas.getContext('webgl2')!,
    preserveDrawingBuffer: true,
    precision: 'mediump',
    antialias: true,
  });
  renderer.autoClear = false;
  renderer.resetState(); // Reset WebGL state

  const camera = new THREE.PerspectiveCamera();
  const scene = new THREE.Scene();
  const timer = new THREE.Timer();

  const group = new THREE.Group();
  group.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0)),
  );
  group.scale.setScalar(3);
  group.position.set(-300, 100, -522);
  scene.add(group);

  function setupScene() {
    RectAreaLightUniformsLib.init();

    const rectLight1 = new THREE.RectAreaLight(0xff0000, 5, 40, 100);
    rectLight1.position.set(-50, -60 - 30, 5);
    group.add(rectLight1);

    const rectLight2 = new THREE.RectAreaLight(0x00ff00, 5, 40, 100);
    rectLight2.position.set(0, -60 - 30, 5);
    group.add(rectLight2);

    const rectLight3 = new THREE.RectAreaLight(0x0000ff, 5, 40, 100);
    rectLight3.position.set(50, -60 - 30, 5);
    group.add(rectLight3);

    group.add(new RectAreaLightHelper(rectLight1));
    group.add(new RectAreaLightHelper(rectLight2));
    group.add(new RectAreaLightHelper(rectLight3));

    const geoKnot = new THREE.TorusKnotGeometry(15, 5, 200, 16);
    const matKnot = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0, metalness: 0 });
    const meshKnot = new THREE.Mesh(geoKnot, matKnot);
    meshKnot.position.set(0, -55 - 30, -30);
    group.add(meshKnot);

    return [rectLight1, rectLight2, rectLight3];
  }

  const [light1, light2, light3] = setupScene();

  // Reused across frames; a fresh AlignedBox per bounds() call would leak wasm memory.
  const bounds = new imf.bindings.AlignedBox();

  const threejsGlObject = {
    render: (viewState: GlViewState) => {
      // Set viewport
      const imfViewport = viewState.viewport();
      renderer.setViewport(imfViewport.x, imfViewport.y, imfViewport.width, imfViewport.height);

      // Setup projection and modelView matrices
      const imfProjectionMatrix = new THREE.Matrix4();
      // Matrix4.set expects elements in row-major order, which matches the ImFusion Web SDK mat4 convention
      imfProjectionMatrix.set(...viewState.projectionMatrix());

      const imfModelViewMatrix = new THREE.Matrix4();
      // To get camera position and orientation, we need the viewToWorld matrix, ImFusion provides worldToView
      imfModelViewMatrix.set(...viewState.modelViewMatrix()).invert();

      // Decompose modelView matrix into camera parameters
      const position = new THREE.Vector3();
      const rotationQuaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      imfModelViewMatrix.decompose(position, rotationQuaternion, scale);

      camera.position.set(position.x, position.y, position.z);
      camera.quaternion.set(rotationQuaternion.x, rotationQuaternion.y, rotationQuaternion.z, rotationQuaternion.w);
      camera.scale.set(scale.x, scale.y, scale.z);

      camera.projectionMatrix.copy(imfProjectionMatrix);
      camera.projectionMatrixInverse.copy(imfProjectionMatrix).invert();

      // Modify the scene based on the elapsed time
      timer.update();
      const delta = timer.getDelta();

      light1.rotation.y += -delta;
      light2.rotation.y += delta * 0.5;
      light3.rotation.y += delta;

      // Actually render the scene
      renderer.render(scene, camera);

      // Reset WebGL state
      renderer.resetState();
    },
    bounds: () => bounds,
  };

  const customGlObject = imf.createCustomGlObject(threejsGlObject, 'glObjectThreeJS');
  imf.display.mainSagittalView().addObject(customGlObject);
  imf.display.main3dView().addObject(customGlObject);

  // Drive a continuous render loop so the animated overlay keeps updating.
  let raf = requestAnimationFrame(function loop() {
    imf.display.render();
    raf = requestAnimationFrame(loop);
  });

  // Cleanup when the host tears the demo down.
  return () => {
    cancelAnimationFrame(raf);
    imf.display.mainSagittalView().removeObject(customGlObject);
    imf.display.main3dView().removeObject(customGlObject);
    customGlObject.delete();
    bounds.delete();
    renderer.dispose();
    imf.display.layouter().setMaximizedView(null);
    imf.resumeAutoRender();
  };
}
