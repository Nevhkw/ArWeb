import { DRACOLoader } from "./libs/three.js-r132/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "./libs/three.js-r132/examples/jsm/loaders/GLTFLoader.js";

const THREE = window.MINDAR.IMAGE.THREE;

const initializeMindAR = () => {
  return new window.MINDAR.IMAGE.MindARThree({
    container: document.body,
    imageTargetSrc: './assets/targets/Lomundou.mind', 
  });
};

// --- FIX: Guna Google Draco CDN ---
const configureGLTFLoader = () => {
  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  // Menggunakan pelayan Google, jadi anda tidak perlu folder 'libs/draco'
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  loader.setDRACOLoader(dracoLoader);
  return loader;
};

const setupLighting = (scene) => {
  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  scene.add(light);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
  dirLight.position.set(0, 5, 5);
  scene.add(dirLight);
};

// --- FIX: Fungsi Load Lebih Selamat (Supaya tak white screen jika error) ---
const loadModel = async (path, scale = { x: 0.1, y: 0.1, z: 0.1 }, position = { x: 0, y: -0.4, z: 0 }) => {
  try {
    const loader = configureGLTFLoader();
    const model = await loader.loadAsync(path);
    model.scene.scale.set(scale.x, scale.y, scale.z);
    model.scene.position.set(position.x, position.y, position.z);
    
    // Matikan auto-play asal jika ada, kita kawal manual nanti
    model.scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    
    return model;
  } catch (error) {
    console.error(`GAGAL memuatkan model di: ${path}`, error);
    return null; // Return null supaya kod seterusnya tahu model ini rosak
  }
};

const enableZoomAndRotation = (camera, model) => {
  if (!model) return; // Skip jika model tiada

  let scaleFactor = 1.0;
  let isDragging = false;
  let previousPosition = { x: 0, y: 0 };
  let initialDistance = null;
  
  const handleStart = (event) => {
    if (event.touches && event.touches.length === 1) {
      isDragging = true;
      previousPosition = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    } else if (event.touches && event.touches.length === 2) {
      isDragging = false;
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      initialDistance = Math.sqrt(dx * dx + dy * dy);
    } else if (event.type === 'mousedown') {
      isDragging = true;
      previousPosition = { x: event.clientX, y: event.clientY };
    }
  };

  const handleMove = (event) => {
    if (isDragging && (event.type === 'mousemove' || (event.touches && event.touches.length === 1))) {
      const currentPosition = event.touches
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
        : { x: event.clientX, y: event.clientY };
      const deltaMove = { x: currentPosition.x - previousPosition.x, y: currentPosition.y - previousPosition.y };
      model.scene.rotation.y += deltaMove.x * 0.01;
      model.scene.rotation.x += deltaMove.y * 0.01;
      previousPosition = currentPosition;
    } else if (event.touches && event.touches.length === 2 && initialDistance) {
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const currentDistance = Math.sqrt(dx * dx + dy * dy);
      const zoomDelta = (currentDistance - initialDistance) * 0.005;
      scaleFactor = Math.min(Math.max(scaleFactor + zoomDelta, 0.5), 2);
      model.scene.scale.set(scaleFactor, scaleFactor, scaleFactor);
      initialDistance = currentDistance;
    }
  };

  const handleEnd = () => { isDragging = false; initialDistance = null; };

  window.addEventListener('mousedown', handleStart);
  window.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', handleEnd);
  window.addEventListener('touchstart', handleStart);
  window.addEventListener('touchmove', handleMove);
  window.addEventListener('touchend', handleEnd);
};

const setupAnchorWithAutoAnimationAndAudio = async (mindarThree, model, anchorId, audioPath) => {
  if (!model) return null; // Skip jika model gagal dimuatkan

  const anchor = mindarThree.addAnchor(anchorId);
  anchor.group.add(model.scene);
  
  const mixer = new THREE.AnimationMixer(model.scene);
  const actions = [];

  if (model.animations.length > 0) {
    model.animations.forEach((clip) => {
      const action = mixer.clipAction(clip);
      action.play(); // Default play
      actions.push(action);
    });
  }

  const audio = new Audio(audioPath);
  
  anchor.onTargetFound = () => {
    console.log(`Target ${anchorId} dijumpai.`);
    model.scene.visible = true;
    actions.forEach((action) => {
      action.paused = false;
      if (!action.isRunning()) action.play();
    });
    audio.currentTime = 0;
    audio.play().catch(e => console.log("Audio play blocked (user interaction needed):", e));
  };

  anchor.onTargetLost = () => {
    console.log(`Target ${anchorId} hilang.`);
    model.scene.visible = false;
    actions.forEach((action) => { action.paused = true; });
    audio.pause();
  };

  return mixer;
};

const enablePlayOnInteraction = (renderer, scene, camera, model, mixer) => {
  if (!model || !mixer) return;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const handleInteraction = (event) => {
    if (event.touches) {
      pointer.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
    } else {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }
    raycaster.setFromCamera(pointer, camera);
    
    // Check intersection with model meshes specifically
    const intersects = raycaster.intersectObjects(model.scene.children, true);
    
    if (intersects.length > 0) {
      mixer._actions.forEach(action => { action.paused = !action.paused; });
    }
  };

  window.addEventListener("pointerdown", handleInteraction);
  window.addEventListener("touchstart", handleInteraction); // Tambah touchstart untuk mobile
};

document.addEventListener('DOMContentLoaded', () => {
  const start = async () => {
    try {
      console.log("Memulakan MindAR...");
      const mindarThree = initializeMindAR();
      const { renderer, scene, camera } = mindarThree;
      renderer.clock = new THREE.Clock();
      setupLighting(scene);

      // --- MUAT TURUN MODEL (dengan semakan error) ---
      // Nota: Pastikan nama fail SAMA DENGAN nama fail sebenar (Case Sensitive!)
      const m1 = await loadModel('./assets/models/scene1.glb', { x: 0.1, y: 0.1, z: 0.1 });
      const m2 = await loadModel('./assets/models/scene2.glb', { x: 0.1, y: 0.1, z: 0.1 });
      const m3 = await loadModel('./assets/models/scene3.glb', { x: 0.1, y: 0.1, z: 0.1 });
      const m4 = await loadModel('./assets/models/scene4.glb', { x: 0.1, y: 0.1, z: 0.1 });
      const m5 = await loadModel('./assets/models/scene5.glb', { x: 0.1, y: 0.1, z: 0.1 });
      const m6 = await loadModel('./assets/models/scene6.glb', { x: 0.1, y: 0.1, z: 0.1 });
      const m7 = await loadModel('./assets/models/scene7.glb', { x: 0.1, y: 0.1, z: 0.1 });
      const m8 = await loadModel('./assets/models/scene8.glb', { x: 0.1, y: 0.1, z: 0.1 });
      const m9 = await loadModel('./assets/models/scene9.glb', { x: 0.1, y: 0.1, z: 0.1 });
      const m10 = await loadModel('./assets/models/scene10.glb', { x: 0.1, y: 0.1, z: 0.1 });

      // Jika m1 gagal (null), kita tak mahu kod seterusnya error.
      // Kita check di dalam fungsi setupAnchorWithAutoAnimationAndAudio
      
      // --- AUDIO SETUP (ENGLISH) ---
      // PENTING: Untuk mainBM.js dan mainDusun.js, tukar bahagian ini sahaja.
      const mix1 = await setupAnchorWithAutoAnimationAndAudio(mindarThree, m1, 0, './assets/audio/dusun/page1.mp3');
      const mix2 = await setupAnchorWithAutoAnimationAndAudio(mindarThree, m2, 1, './assets/audio/dusun/page2.mp3');
      const mix3 = await setupAnchorWithAutoAnimationAndAudio(mindarThree, m3, 2, './assets/audio/dusun/page3.mp3');
      const mix4 = await setupAnchorWithAutoAnimationAndAudio(mindarThree, m4, 3, './assets/audio/dusun/page4.mp3');
      const mix5 = await setupAnchorWithAutoAnimationAndAudio(mindarThree, m5, 4, './assets/audio/dusun/page5.mp3');
      const mix6 = await setupAnchorWithAutoAnimationAndAudio(mindarThree, m6, 5, './assets/audio/dusun/page6.mp3');
      const mix7 = await setupAnchorWithAutoAnimationAndAudio(mindarThree, m7, 6, './assets/audio/dusun/page7.mp3');
      const mix8 = await setupAnchorWithAutoAnimationAndAudio(mindarThree, m8, 7, './assets/audio/dusun/page8.mp3');
      const mix9 = await setupAnchorWithAutoAnimationAndAudio(mindarThree, m9, 8, './assets/audio/dusun/page9.mp3');
      const mix10 = await setupAnchorWithAutoAnimationAndAudio(mindarThree, m10, 9, './assets/audio/dusun/page10.mp3');

      const models = [m1, m2, m3, m4, m5, m6, m7, m8, m9, m10];
      const mixers = [mix1, mix2, mix3, mix4, mix5, mix6, mix7, mix8, mix9, mix10];

      models.forEach((m, i) => {
          if (m) { // Hanya setup jika model wujud
             enableZoomAndRotation(camera, m);
             enablePlayOnInteraction(renderer, scene, camera, m, mixers[i]);
          }
      });

      console.log("Semua model diproses. Membuka kamera...");
      await mindarThree.start();
      
      renderer.setAnimationLoop(() => {
        const delta = renderer.clock.getDelta();
        // Hanya update mixer yang wujud (tidak null)
        mixers.forEach(mix => {
            if (mix) mix.update(delta);
        });
        renderer.render(scene, camera);
      });
      
    } catch (err) {
      console.error("CRITICAL ERROR:", err);
      alert("Ralat Sistem: Sila semak konsol. " + err.message);
    }
  };
  start();
});