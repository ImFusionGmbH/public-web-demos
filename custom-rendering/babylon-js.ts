import {
  Color3,
  FreeCamera,
  Matrix,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Quaternion,
  RectAreaLight,
  Scene,
  StandardMaterial,
  ThinEngine,
  TransformNode,
  Vector3,
  Viewport,
} from '@babylonjs/core';
import type { ImFusion, GlViewState } from '@imfusion/sdk';

/**
 * babylon.js custom rendering for the ImFusion Web SDK.
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

  const gl = imf.canvas.getContext('webgl2')!;

  // babylon's ThinEngine constructor calls resize(), which overwrites canvas.width/height
  // with a CSS-derived size, so we capture the SDK's drawing-buffer size and restore it
  // right after constructing the engine.
  const bufferWidth = imf.canvas.width;
  const bufferHeight = imf.canvas.height;

  const engine = new ThinEngine(gl, true, { preserveDrawingBuffer: true }, false);
  imf.canvas.width = bufferWidth;
  imf.canvas.height = bufferHeight;

  const scene = new Scene(engine);
  scene.detachControl();
  scene.autoClear = false;
  scene.useRightHandedSystem = true;

  // Reset GL State
  engine.wipeCaches(true);
  gl.disable(gl.CULL_FACE);

  const camera = new FreeCamera('camera1', Vector3.Zero(), scene);

  const root = new TransformNode('demoRoot', scene);
  const orient = new Matrix();
  Matrix.FromXYZAxesToRef(new Vector3(0, 1, 0), new Vector3(0, 0, -1), new Vector3(-1, 0, 0), orient);
  root.rotationQuaternion = Quaternion.FromRotationMatrix(orient);
  root.scaling.setAll(1.8);
  root.position.set(-296.4, -241.4, -233.0);

  function setupScene() {
    function createLight(position: Vector3, rotation: Vector3, color: Color3, name: string) {
      const lightBox = MeshBuilder.CreateBox('box' + name, { width: 30, height: 60, depth: 0.01 });
      const lightMaterial = new StandardMaterial('mat');
      lightMaterial.disableLighting = true;
      lightMaterial.emissiveColor = color;
      lightBox.material = lightMaterial;

      lightBox.parent = root;
      lightBox.position = position;
      lightBox.rotation = rotation;
      lightBox.scaling.set(1, 2, 0.5);

      // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
      const light = new RectAreaLight('light' + name, new Vector3(0, 0, 0), 30, 60, scene);
      light.parent = lightBox;
      light.specular = color;
      light.diffuse = color;

      // Default intensity is 1. Let's dim the light a small amount
      light.intensity = 0.7;
      return lightBox;
    }

    const lightBoxes: Mesh[] = [];
    for (let i = 0; i < 9; i++) {
      lightBoxes.push(
        createLight(new Vector3(i * 50, 7, 0), new Vector3(0, 0, 0), new Color3(0.9, 0.8, 0.8), 'light1'),
      );
    }

    const sphereMaterialA = new PBRMaterial('sphereA', scene);
    sphereMaterialA.roughness = 0.2;
    sphereMaterialA.metallic = 0.2;
    sphereMaterialA.albedoColor = Color3.White();
    sphereMaterialA.maxSimultaneousLights = 9;

    const sphereMaterialB = new PBRMaterial('sphereB', scene);
    sphereMaterialB.roughness = 0.5;
    sphereMaterialB.metallic = 0.5;
    sphereMaterialB.albedoColor = Color3.White();
    sphereMaterialB.maxSimultaneousLights = 9;

    for (let i = 0; i < 10; i++) {
      const sphere = MeshBuilder.CreateSphere('sphere', { diameter: 30, segments: 32 }, scene);
      sphere.parent = root;
      sphere.material = i & 1 ? sphereMaterialA : sphereMaterialB;
      sphere.position.set(Math.random() * 220 + 80, Math.random() * 40 + 2, Math.random() * 40 - 80);
      const sc = Math.random() * 0.8 + 0.5;
      sphere.scaling.set(sc, sc, sc);
    }

    return lightBoxes;
  }

  const lightBoxes = setupScene();
  let time = 0.0;

  // Reused across frames; a fresh AlignedBox per bounds() call would leak wasm memory.
  const bounds = new imf.bindings.AlignedBox();

  const babylonGlObject = {
    render: (viewState: GlViewState) => {
      // Set Viewport
      // Babylon.js viewport is specified in normalized coordinates [0-1]
      const imfViewport = viewState.viewport();
      camera.viewport = new Viewport(
        imfViewport.x / imf.canvas.width,
        imfViewport.y / imf.canvas.height,
        imfViewport.width / imf.canvas.width,
        imfViewport.height / imf.canvas.height,
      );

      // Setup projection and modelView matrices

      // Transpose because of row-major vs column-major difference in matrix storage
      // Invert because in order to get camera position and orientation, we need the viewToWorld matrix, while ImFusion provides worldToView
      const modelViewMatrix = Matrix.FromArray(viewState.modelViewMatrix()).transpose().invert();

      // Decompose modelViewMatrix
      const scale = Vector3.Zero();
      const translation = Vector3.Zero();
      const quaternion = Quaternion.Zero();
      modelViewMatrix.decompose(scale, quaternion, translation);
      camera.position = translation;
      camera.rotationQuaternion = quaternion;

      // Transpose because of row-major vs column-major difference
      const projectionMatrix = Matrix.FromArray(viewState.projectionMatrix()).transpose();
      camera.freezeProjectionMatrix(projectionMatrix);

      // Scene manipulation based on elapsed time
      for (let i = 0; i < lightBoxes.length; i++) {
        const sc = Math.max(Math.cos(time * Math.PI - Math.abs(i - 4) * 0.2) - 0.8, 0) * 4 + 1.5;
        lightBoxes[i].scaling.y = sc;
        const material = lightBoxes[i].material as StandardMaterial;
        material.emissiveColor.r = 0.6 + sc * 0.3;
      }
      time += (scene.deltaTime ?? 0) * 0.0016;

      // Actually render the scene
      scene.render(false);

      // Reset GL State
      engine.wipeCaches(true);
      gl.disable(gl.CULL_FACE);
    },
    bounds: () => bounds,
  };

  const customGlObject = imf.createCustomGlObject(babylonGlObject, 'glObjectBabylonJS');
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
    scene.dispose();
    engine.dispose();
    imf.display.layouter().setMaximizedView(null);
    imf.resumeAutoRender();
  };
}
