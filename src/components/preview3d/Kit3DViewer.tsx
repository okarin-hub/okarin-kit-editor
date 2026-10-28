'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createLongSleeves, LongSleeveController } from '@/utils/longSleeves';

/** Shorts UV island of the model (left side, texture px) and where it starts in the game's template. */
const SHORTS_UV_LEFT = 80.94;
const SHORTS_UV_RIGHT = 319.8;

/** Stretches the left outer edge of each shorts leg from x 81 to x 0 (the inner edge at x 320 stays). */
function remapShortsUV(mesh: THREE.Mesh) {
  const uv = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if (!uv) return;
  const k = SHORTS_UV_RIGHT / (SHORTS_UV_RIGHT - SHORTS_UV_LEFT);
  const stretch = (x: number) => (x - SHORTS_UV_LEFT) * k;
  for (let i = 0; i < uv.count; i++) {
    const x = uv.getX(i) * 1024;
    if (x < 512) uv.setX(i, stretch(x) / 1024);
    else uv.setX(i, (1024 - stretch(1024 - x)) / 1024);
  }
  uv.needsUpdate = true;
}
import {
  Rotate3d,
  Maximize2,
  RefreshCw,
  Sun,
  Eye,
  Camera,
  Shirt,
  Sparkles,
  ArrowUpDown,
} from 'lucide-react';

/**
 * A template layer that can be dragged directly on the 3D model. `hit` tells whether a texture
 * point (1024 x 1024 space) lies on the layer, `onMove` receives the UV movement in texture pixels.
 */
export interface ZoneDragTarget {
  zoneId: string;
  hit: (x: number, y: number) => boolean;
  onMove: (dx: number, dy: number) => void;
}

interface Kit3DViewerProps {
  textureDataUrl: string | null;
  className?: string;
  zoneDrag?: ZoneDragTarget | null;
}

export const Kit3DViewer: React.FC<Kit3DViewerProps> = ({
  textureDataUrl,
  className = '',
  zoneDrag = null,
}) => {
  const zoneDragRef = useRef<ZoneDragTarget | null>(zoneDrag);
  zoneDragRef.current = zoneDrag;
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const kitMeshGroupRef = useRef<THREE.Group | null>(null);
  const kitMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const textureDataUrlRef = useRef<string | null>(textureDataUrl);

  const [isLoading, setIsLoading] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [sleeveMode, setSleeveMode] = useState<'short' | 'long'>('short');
  const sleeveModeRef = useRef<'short' | 'long'>('short');
  const sleeveCtlRef = useRef<LongSleeveController | null>(null);
  const [cameraView, setCameraView] = useState<'front' | 'back' | 'chest' | 'lower' | 'full'>('front');

  // Keep texture ref updated
  useEffect(() => {
    textureDataUrlRef.current = textureDataUrl;
  }, [textureDataUrl]);

  // Helper to load and bind texture into Three.js material
  const textureSeq = useRef(0);
  const applyTextureToMaterial = (mat: THREE.MeshStandardMaterial, url: string) => {
    const textureLoader = new THREE.TextureLoader();
    const seq = ++textureSeq.current;
    textureLoader.load(
      url,
      (texture) => {
        // a newer texture was requested while this one decoded: drop the stale one
        if (seq !== textureSeq.current) {
          texture.dispose();
          return;
        }
        mat.map?.dispose();
        texture.flipY = false; // glTF standard
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;

        mat.map = texture;
        mat.color.set(0xffffff); // Neutral white base so texture colors appear vibrant
        mat.needsUpdate = true;
      },
      undefined,
      (err) => console.error('Failed to load texture into 3D model:', err)
    );
  };

  // 1. Setup Three.js Scene, Camera, Renderer, Lighting, and Controls
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // The panel can be hidden (display: none) while another view mode is active: size 0 is not drawable
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    let disposed = false;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d14);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.2, 2.2);
    cameraRef.current = camera;

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Orbit Controls with Turntable Lock
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 4.2;
    controls.minDistance = 0.8;
    controls.target.set(0, 0.1, 0);

    // Lock polar angle so model does NOT flip or tilt upside down
    controls.minPolarAngle = Math.PI * 0.48;
    controls.maxPolarAngle = Math.PI * 0.52;

    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 2.0;
    controlsRef.current = controls;

    // Custom Pointer Drag: Left-click vertical movement moves model up & down (Vertical Panning)
    let isPointerDown = false;
    let startY = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0) { // Left click
        isPointerDown = true;
        startY = e.clientY;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isPointerDown) return;
      const deltaY = e.clientY - startY;
      startY = e.clientY;

      // Moving mouse down (deltaY > 0) -> camera target moves down / view moves up
      const panSpeed = 0.0028;
      const panDelta = deltaY * panSpeed;

      const currentY = controls.target.y;
      const newY = THREE.MathUtils.clamp(currentY + panDelta, -0.65, 0.55);
      const diff = newY - currentY;

      controls.target.y = newY;
      camera.position.y += diff;
    };

    const onPointerUp = () => {
      isPointerDown = false;
    };

    const domElem = renderer.domElement;

    // ---- Drag a template layer directly on the model: the UV under the pointer drives the layer ----
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const uvAt = (clientX: number, clientY: number): { x: number; y: number } | null => {
      const group = kitMeshGroupRef.current;
      if (!group) return null;
      const rect = domElem.getBoundingClientRect();
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const meshes: THREE.Object3D[] = [];
      group.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o.visible) meshes.push(o);
      });
      const hit = raycaster.intersectObjects(meshes, false)[0];
      if (!hit || !hit.uv) return null;
      return { x: hit.uv.x * 1024, y: hit.uv.y * 1024 };
    };

    let zoneDragging = false;
    let anchor: { x: number; y: number } | null = null;

    const onZonePointerDown = (e: PointerEvent) => {
      const target = zoneDragRef.current;
      if (!target || e.button !== 0) return;
      const p = uvAt(e.clientX, e.clientY);
      if (!p || !target.hit(p.x, p.y)) return;
      zoneDragging = true;
      anchor = p;
      controls.enabled = false;
      domElem.style.cursor = 'grabbing';
      // keep OrbitControls and the vertical-pan handler from reacting to this press
      e.stopPropagation();
      e.preventDefault();
    };

    const onZonePointerMove = (e: PointerEvent) => {
      const target = zoneDragRef.current;
      if (zoneDragging && target && anchor) {
        const p = uvAt(e.clientX, e.clientY);
        if (!p) return;
        const dx = p.x - anchor.x;
        const dy = p.y - anchor.y;
        // a jump of the UV position means the pointer crossed a UV seam: re-anchor without moving
        if (Math.abs(dx) < 120 && Math.abs(dy) < 120) {
          if (dx || dy) target.onMove(dx, dy);
        }
        anchor = p;
        return;
      }
      if (target && e.buttons === 0) {
        const p = uvAt(e.clientX, e.clientY);
        domElem.style.cursor = p && target.hit(p.x, p.y) ? 'move' : '';
      }
    };

    const onZonePointerUp = () => {
      if (!zoneDragging) return;
      zoneDragging = false;
      anchor = null;
      controls.enabled = true;
      domElem.style.cursor = '';
    };

    container.addEventListener('pointerdown', onZonePointerDown, true);
    window.addEventListener('pointermove', onZonePointerMove);
    window.addEventListener('pointerup', onZonePointerUp);

    domElem.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // Lighting (Studio & Stadium setup)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    // Key Light
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(2, 3, 2.5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    // Fill Light
    const fillLight = new THREE.DirectionalLight(0x90b0e0, 0.9);
    fillLight.position.set(-2.5, 1.5, 1.5);
    scene.add(fillLight);

    // Rim / Back Light (Enhances football jersey fabric edge silhouettes)
    const rimLight = new THREE.DirectionalLight(0xfff0dd, 1.2);
    rimLight.position.set(0, 2.5, -2.5);
    scene.add(rimLight);

    // Subtle Ground Shadow Plane
    const groundGeo = new THREE.PlaneGeometry(5, 5);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.95;
    ground.receiveShadow = true;
    scene.add(ground);

    // Load PES Kit Model (/model/pes_kit.glb)
    const loader = new GLTFLoader();
    setIsLoading(true);

    loader.load(
      '/model/pes_kit.glb',
      (gltf) => {
        if (disposed) return; // unmounted (or React strict-mode remount) before the model arrived
        const model = gltf.scene;
        kitMeshGroupRef.current = model;

        // Create standard kit material with realistic cloth roughness
        const kitMat = new THREE.MeshStandardMaterial({
          roughness: 0.65,
          metalness: 0.08,
          side: THREE.DoubleSide,
        });
        kitMaterialRef.current = kitMat;

        // Apply material and compute center
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.material = kitMat;
          }
        });

        // The game reads the whole shorts area of the template (x 0..~330) but this model's shorts UVs
        // only cover x 81..320: stretch them so the 3D preview shows what the game shows.
        model.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh && /pants/i.test(mesh.name)) remapShortsUV(mesh);
        });

        // Procedural long sleeves (the model itself only has short sleeves)
        let sleeveMesh: THREE.Mesh | null = null;
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && /sleeve/i.test(child.name)) sleeveMesh = child as THREE.Mesh;
        });
        if (sleeveMesh) {
          sleeveCtlRef.current = createLongSleeves(sleeveMesh, kitMat);
          sleeveCtlRef.current?.setLong(sleeveModeRef.current === 'long');
        }

        // Center and scale model to fit view nicely
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.6 / (maxDim || 1);
        model.scale.setScalar(scale);

        // Adjust vertical position so feet stand on ground
        model.position.x = -center.x * scale;
        model.position.y = -center.y * scale + 0.05;
        model.position.z = -center.z * scale;

        scene.add(model);
        setIsLoading(false);

        // Immediately apply texture if already available upon model load!
        if (textureDataUrlRef.current) {
          applyTextureToMaterial(kitMat, textureDataUrlRef.current);
        }
      },
      undefined,
      (err) => {
        if (disposed) return;
        console.error('Failed to load pes_kit.glb:', err);
        setIsLoading(false);
      }
    );

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (!container.clientWidth || !container.clientHeight) return; // hidden: skip the work
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize with the container (window resize, split / single view switch)
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      container.removeEventListener('pointerdown', onZonePointerDown, true);
      window.removeEventListener('pointermove', onZonePointerMove);
      window.removeEventListener('pointerup', onZonePointerUp);
      domElem.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      renderer.forceContextLoss(); // browsers cap live WebGL contexts; release this one right away
    };
  }, []);

  // 2. Real-Time Dynamic Texture Synchronization
  useEffect(() => {
    if (!kitMaterialRef.current || !textureDataUrl) return;
    applyTextureToMaterial(kitMaterialRef.current, textureDataUrl);
  }, [textureDataUrl]);

  // Short / long sleeves
  useEffect(() => {
    sleeveModeRef.current = sleeveMode;
    sleeveCtlRef.current?.setLong(sleeveMode === 'long');
  }, [sleeveMode]);

  // 3. Update Auto-Rotate
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // 4. Camera View Presets
  const setView = (view: 'front' | 'back' | 'chest' | 'lower' | 'full') => {
    setCameraView(view);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (view === 'front') {
      camera.position.set(0, 0.2, 2.2);
      controls.target.set(0, 0.1, 0);
    } else if (view === 'back') {
      camera.position.set(0, 0.2, -2.2);
      controls.target.set(0, 0.1, 0);
    } else if (view === 'chest') {
      camera.position.set(0, 0.35, 1.4);
      controls.target.set(0, 0.35, 0);
    } else if (view === 'lower') {
      camera.position.set(0, -0.22, 1.6);
      controls.target.set(0, -0.22, 0);
    } else if (view === 'full') {
      camera.position.set(0.6, 0.05, 2.6);
      controls.target.set(0, 0.05, 0);
    }
    controls.update();
  };

  return (
    <div className={`relative w-full h-full rounded-2xl overflow-hidden bg-[#0a0d14] border border-slate-800 ${className}`}>
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing select-none" />

      {/* Loading Indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0d14]/90 z-20 text-slate-400 gap-3">
          <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold tracking-wide">
            Memuat Model 3D PES 2021 (CometKIT)...
          </span>
        </div>
      )}

      {/* Top Floating Control Bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10 pointer-events-none">
        {/* Left: camera angles */}
        <div className="flex items-center gap-0.5 bg-[#121622]/90 backdrop-blur-md p-1 rounded-lg border border-slate-800 shadow-xl pointer-events-auto overflow-x-auto min-w-0">
          {(
            [
              ['front', 'Depan', 'Tampak depan'],
              ['back', 'Belakang', 'Tampak belakang'],
              ['chest', 'Dada', 'Zoom ke dada'],
              ['lower', 'Bawah', 'Celana dan kaus kaki'],
              ['full', 'Penuh', 'Seluruh badan'],
            ] as const
          ).map(([view, label, title]) => (
            <button
              key={view}
              onClick={() => setView(view)}
              title={title}
              className={`h-6 px-2 rounded-md text-[11px] font-bold whitespace-nowrap transition-all ${
                cameraView === view
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Right: auto rotate & reset */}
        <div className="flex items-center gap-0.5 bg-[#121622]/90 backdrop-blur-md p-1 rounded-lg border border-slate-800 shadow-xl pointer-events-auto shrink-0">
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`h-6 px-1.5 rounded-md text-xs transition-all flex items-center gap-1.5 ${
              autoRotate
                ? 'bg-rose-600 text-white font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Putar otomatis (turntable 360°)"
          >
            <Rotate3d className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold hidden 2xl:inline">Putar</span>
          </button>

          <button
            onClick={() => setView('front')}
            className="h-6 w-6 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Reset sudut kamera"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sleeves: short / long */}
        <div className="absolute bottom-2 left-3 z-10 flex items-center gap-0.5 bg-[#121622]/90 backdrop-blur-md p-1 rounded-lg border border-slate-800 shadow-xl pointer-events-auto">
          {(
            [
              ['short', 'Lengan pendek'],
              ['long', 'Lengan panjang'],
            ] as const
          ).map(([mode, title]) => (
            <button
              key={mode}
              onClick={() => setSleeveMode(mode)}
              title={`${title} (lengan panjang dibuat otomatis dan memakai area lengan panjang di template)`}
              className={`h-6 px-2 rounded-md text-[11px] font-bold whitespace-nowrap transition-all ${
                sleeveMode === mode
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              {mode === 'short' ? 'Lengan pendek' : 'Lengan panjang'}
            </button>
          ))}
        </div>

      {/* Bottom hint (short, hidden on small windows) */}
      <div className="absolute bottom-2 right-3 pointer-events-none z-10 hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/70 backdrop-blur-md border border-slate-800/80 text-[10px] text-slate-400 whitespace-nowrap">
        <ArrowUpDown className="w-3 h-3 text-sky-400" />
        <span>Seret: putar &bull; Scroll: zoom</span>
      </div>
    </div>
  );
};

export default Kit3DViewer;
