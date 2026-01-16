import { DRACOLoader } from "./libs/three.js-r132/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "./libs/three.js-r132/examples/jsm/loaders/GLTFLoader.js";

const THREE = window.MINDAR.IMAGE.THREE;

// Function to initialize the MindARThree instance
const initializeMindAR = () => {
  return new window.MINDAR.IMAGE.MindARThree({
    container: document.body, // Attach AR experience to the body
    imageTargetSrc: './assets/targets/Lomundou.mind',
  });
};

// Configure GLTFLoader with DRACOLoader
const configureGLTFLoader = () => {
  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('/storybook/libs/draco/'); // Path to DRACO decoder files
  loader.setDRACOLoader(dracoLoader);
  return loader;
};

// Function to set up lighting in the scene
const setupLighting = (scene) => {
  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1); // Add a light source
  scene.add(light);
};

// Function to load the GLB model with animations
const loadModel = async (path, scale = { x: 0.15, y: 0.15, z: 0.15 }, position = { x: 0, y: -0.4, z: 0 }) => {
  const loader = configureGLTFLoader();
  const model = await loader.loadAsync(path);

  // Set the scale
  model.scene.scale.set(scale.x, scale.y, scale.z);

  // Set the position
  model.scene.position.set(position.x, position.y, position.z);

  return model;
};

// Enable zoom and rotation
const enableZoomAndRotation = (camera, model) => {
  let scaleFactor = 1.0; // Default scaling factor
  let isDragging = false;
  let previousPosition = { x: 0, y: 0 };
  let initialDistance = null; // Used for pinch-to-zoom on mobile
  
  // Handle mouse and touch start
  const handleStart = (event) => {
    if (event.touches && event.touches.length === 1) {
      // Single touch: start drag
      isDragging = true;
      previousPosition = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    } else if (event.touches && event.touches.length === 2) {
      // Pinch-to-zoom start
      isDragging = false; // Disable dragging during zoom
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      initialDistance = Math.sqrt(dx * dx + dy * dy);
    } else if (event.type === 'mousedown') {
      // Mouse: start drag
      isDragging = true;
      previousPosition = { x: event.clientX, y: event.clientY };
    }
  };

  // Handle mouse and touch move
  const handleMove = (event) => {
    if (isDragging && (event.type === 'mousemove' || (event.touches && event.touches.length === 1))) {
      const currentPosition = event.touches
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
        : { x: event.clientX, y: event.clientY };

      const deltaMove = {
        x: currentPosition.x - previousPosition.x,
        y: currentPosition.y - previousPosition.y,
      };

      // Rotate the model
      model.scene.rotation.y += deltaMove.x * 0.01; // Horizontal rotation
      model.scene.rotation.x += deltaMove.y * 0.01; // Vertical rotation
      previousPosition = currentPosition;
    } else if (event.touches && event.touches.length === 2 && initialDistance) {
      // Pinch-to-zoom
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const currentDistance = Math.sqrt(dx * dx + dy * dy);

      // Adjust scale factor
      const zoomDelta = (currentDistance - initialDistance) * 0.005; // Adjust zoom sensitivity
      scaleFactor = Math.min(Math.max(scaleFactor + zoomDelta, 0.5), 2); // Clamp scale between 0.5 and 2
      model.scene.scale.set(scaleFactor, scaleFactor, scaleFactor);

      initialDistance = currentDistance; // Update the distance for next calculation
    }
  };

  // Handle mouse and touch end
  const handleEnd = () => {
    isDragging = false;
    initialDistance = null; // Reset pinch-to-zoom
  };

  // Add event listeners
  window.addEventListener('mousedown', handleStart);
  window.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', handleEnd);

  window.addEventListener('touchstart', handleStart);
  window.addEventListener('touchmove', handleMove);
  window.addEventListener('touchend', handleEnd);
};

// Function to set up anchors with automatic animation, audio playback, and sound effect
const setupAnchorWithAutoAnimationAndAudio = async (mindarThree, model, anchorId, audioPath, soundEffectPath) => {
  const anchor = mindarThree.addAnchor(anchorId);
  anchor.group.add(model.scene);

  // Create a unique mixer for this model
  const mixer = new THREE.AnimationMixer(model.scene);
  const animations = model.animations;

  const actions = []; // Array to store actions for all animations

  if (animations.length > 0) {
    animations.forEach((clip) => {
      const action = mixer.clipAction(clip);
      action.play(); // Play each animation
      actions.push(action); // Store all actions
    });
  }

 // Load the audio for narration and sound effect
const audio = new Audio(audioPath);
audio.loop = true; // Enable looping for the narration audio
const soundEffect = new Audio(soundEffectPath); // Sound effect
soundEffect.loop = true; // Enable looping for the sound effect

anchor.onTargetFound = () => {
  model.scene.visible = true;
  if (animations.length > 0) {
    actions.forEach((action) => {
      action.paused = false; // Resume all animations
      if (!action.isRunning()) {
        action.play(); // Ensure animation starts if it was not playing
      }
    });
  }

  // Play the narration audio
  audio.currentTime = 0; // Reset audio playback
  audio.play();

  // Play the sound effect
  soundEffect.currentTime = 0; // Reset sound effect playback
  soundEffect.play();
};

anchor.onTargetLost = () => {
  model.scene.visible = false;
  if (animations.length > 0) {
    actions.forEach((action) => {
      action.paused = true; // Pause all animations
    });
  }
  
  // Pause the narration audio
  audio.pause();

  // Pause the sound effect
  soundEffect.pause();
};

  return mixer;
};

const enablePlayOnInteraction = (renderer, scene, camera, model, mixer) => {
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

    // Raycasting to check if the model is clicked
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(model.scene.children, true);

    if (intersects.length > 0) {
      // Toggle pause for all actions (not just the first one)
      mixer._actions.forEach(action => {
        action.paused = !action.paused; // Toggle pause/play for all animations
        if (!action.isRunning()) {
          action.play(); // Ensure animation starts if it was not playing
        }
      });
    }
  };

  // Add event listeners for interaction
  window.addEventListener("pointerdown", handleInteraction);
  window.addEventListener("touchstart", handleInteraction);
};

const startRenderingLoop = (renderer, scene, camera, options) => {
  renderer.setAnimationLoop(() => {
    const delta = renderer.clock.getDelta();
    if (options.update) options.update(delta);
    renderer.render(scene, camera);
  });
};

document.addEventListener('DOMContentLoaded', () => {
  const start = async () => {
    const mindarThree = initializeMindAR();
    const { renderer, scene, camera } = mindarThree;

    renderer.clock = new THREE.Clock(); // Create a clock for animations
    setupLighting(scene); // Add lighting

    // Load models and set up anchors
    const page1Model = await loadModel(
  './assets/models/scene1.glb', 
  { x: 0.04, y: 0.04, z: 0.04 }, // Scale for page1
  { x: 0, y: -0.4, z: 0 }        // Position for page1
);
    const page2Model = await loadModel('./assets/models/scene2.glb', 
  { x: 0.08, y: 0.08, z: 0.08 }, // Scale for page2
  { x: 0, y: -0.4, z: 0 }        // Position for page2
);
    const page3Model = await loadModel('./assets/models/scene3.glb', 
  { x: 0.08, y: 0.08, z: 0.08 }, // Scale for page3
  { x: 0, y: -0.4, z: 0 }        // Position for page3
);
    const page4Model = await loadModel('./assets/models/scene4.glb', 
  { x: 0.04, y: 0.04, z: 0.04 }, // Scale for page4
  { x: -0.1, y: -0.4, z: -1.0 }        // Position for page4
);

const page5Model = await loadModel('./assets/models/scene5.glb', 
  { x: 0.04, y: 0.04, z: 0.04 }, // Scale for page5
  { x: 0, y: -0.4, z: 0 }        // Position for page5
);

const page6Model = await loadModel('./assets/models/scene6.glb', 
  { x: 0.06, y: 0.06, z: 0.06 }, // Scale for page6
  { x: 0, y: -1.0, z: 0 }        // Position for page6
);

const page7Model = await loadModel('./assets/models/scene7.glb', 
  { x: 0.02, y: 0.02, z: 0.02 }, // Scale for page7
  { x: 0, y: -0.6, z: 0 }        // Position for page7
);

const page8Model = await loadModel('./assets/models/scene8.glb', 
  { x: 0.02, y: 0.02, z: 0.02 }, // Scale for page8
  { x: 0, y: -0.5, z: 0 }        // Position for page8
);

const page9Model = await loadModel('./assets/models/scene9.glb', 
  { x: 0.02, y: 0.02, z: 0.02 }, // Scale for page9
  { x: 0, y: -0.3, z: 0 }        // Position for page9
);

const page10Model = await loadModel('./assets/models/scene10.glb', 
  { x: 0.06, y: 0.06, z: 0.06 }, // Scale for page10
  { x: 0, y: -0.4, z: 0 }        // Position for page10
);

const page1Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page1Model, 0, './assets/audio/english/page1.mp3');

     const page2Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page2Model, 1,  './assets/audio/english/page2.mp3');

     const page3Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page3Model, 2,  './assets/audio/english/page3.mp3');

     const page4Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page4Model, 3,  './assets/audio/english/page4.mp3');

     const page5Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page5Model, 4,  './assets/audio/english/page5.mp3');

     const page6Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page6Model, 5,  './assets/audio/english/page6.mp3');

     const page7Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page7Model, 6,  './assets/audio/english/page7.mp3');

     const page8Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page8Model, 7,  './assets/audio/english/page8.mp3');

     const page9Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page9Model, 8,  './assets/audio/english/page9.mp3');

     const page10Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page10Model, 9,  './assets/audio/english/page10.mp3');


 // Enable interaction for each model
    enablePlayOnInteraction(renderer, scene, camera, page1Model, page1Mixer);
    enableZoomAndRotation(camera, page1Model);

    enablePlayOnInteraction(renderer, scene, camera, page2Model, page2Mixer);
    enableZoomAndRotation(camera, page2Model);

    enablePlayOnInteraction(renderer, scene, camera, page3Model, page3Mixer);
    enableZoomAndRotation(camera, page3Model);

    enablePlayOnInteraction(renderer, scene, camera, page4Model, page4Mixer);
    enableZoomAndRotation(camera, page4Model);

    enablePlayOnInteraction(renderer, scene, camera, page5Model, page5Mixer);
    enableZoomAndRotation(camera, page5Model);

    enablePlayOnInteraction(renderer, scene, camera, page6Model, page6Mixer);
    enableZoomAndRotation(camera, page6Model);

    enablePlayOnInteraction(renderer, scene, camera, page7Model, page7Mixer);
    enableZoomAndRotation(camera, page7Model);

    enablePlayOnInteraction(renderer, scene, camera, page8Model, page8Mixer);
    enableZoomAndRotation(camera, page8Model);

    enablePlayOnInteraction(renderer, scene, camera, page9Model, page9Mixer);
    enableZoomAndRotation(camera, page9Model);

    enablePlayOnInteraction(renderer, scene, camera, page10Model, page10Mixer);
    enableZoomAndRotation(camera, page10Model);

    // Start AR session and rendering loop
    await mindarThree.start();
    startRenderingLoop(renderer, scene, camera, {
      update: (delta) => {
        page1Mixer.update(delta);
        page2Mixer.update(delta);
        page3Mixer.update(delta);
        page4Mixer.update(delta);
        page5Mixer.update(delta);
        page6Mixer.update(delta);
        page7Mixer.update(delta);
        page8Mixer.update(delta);
        page9Mixer.update(delta);
        page10Mixer.update(delta);
      },
    });
  };

  start();
});