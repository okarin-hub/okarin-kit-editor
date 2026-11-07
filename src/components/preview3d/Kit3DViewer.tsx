'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { zoomFactor, onPrefsChange } from '@/utils/uiPrefs';
import { ModelChoice, PreviewChoice, modelChoiceFromConfig, partVisible } from '@/utils/kitModelParts';
import { MenuHeading, MenuSeparator } from '@/components/ui/Menus';

const DEFAULT_PREVIEW: PreviewChoice = { sleeves: 'short', socks: 'middle', captain: false, tucked: false };
import { DEFAULT_KIT_CONFIG } from '@/utils/kitConfig';

/** Shows only the model parts of this choice (the model holds every collar, sleeve, shorts and sock variant). */
function applyModelChoice(model: THREE.Object3D, choice: ModelChoice) {
  model.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.visible = partVisible(o.name, choice);
  });
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
  ChevronUp,
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
  /** The kit texture (a fresh canvas from renderKitCanvas each time it changes). */
  textureCanvas: HTMLCanvasElement | null;
  className?: string;
  zoneDrag?: ZoneDragTarget | null;
  /** Kit config text: collar, shorts model, Kappa sleeves and tight kit pick the model parts. */
  kitConfig?: string;
}

export const Kit3DViewer: React.FC<Kit3DViewerProps> = ({
  textureCanvas,
  className = '',
  zoneDrag = null,
  kitConfig = DEFAULT_KIT_CONFIG,
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
  const textureCanvasRef = useRef<HTMLCanvasElement | null>(textureCanvas);

  const [isLoading, setIsLoading] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [preview, setPreview] = useState<PreviewChoice>(DEFAULT_PREVIEW);
  const setPreviewKey = <K extends keyof PreviewChoice>(key: K, value: PreviewChoice[K]) =>
    setPreview((p) => ({ ...p, [key]: value }));
  const choice = modelChoiceFromConfig(kitConfig, preview);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewMenuRef = useRef<HTMLDivElement | null>(null);
  // one word per choice (each its own text node, so the translator can swap it)
  const previewSummary = [
    { short: 'Pendek', long: 'Panjang', gk: 'Kiper' }[preview.sleeves],
    { short: 'Pendek', middle: 'Sedang', long: 'Panjang' }[preview.socks],
    ...(preview.captain ? ['Ban kapten'] : []),
    ...(preview.tucked ? ['Dimasukkan'] : []),
  ].map((w, i) => (
    <React.Fragment key={i}>
      {i > 0 && ' · '}
      <span>{w}</span>
    </React.Fragment>
  ));

  // the popup closes on a click outside it or Escape
  useEffect(() => {
    if (!previewOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!previewMenuRef.current?.contains(e.target as Node)) setPreviewOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPreviewOpen(false);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [previewOpen]);
  const choiceRef = useRef(choice);
  choiceRef.current = choice;
  const choiceKey = JSON.stringify(choice);
  const [cameraView, setCameraView] = useState<'front' | 'back' | 'chest' | 'lower' | 'full'>('front');

  // Keep texture ref updated
  useEffect(() => {
    textureCanvasRef.current = textureCanvas;
  }, [textureCanvas]);

  // The kit canvas goes straight onto the GPU (no PNG encode / decode in between)
  const applyTextureToMaterial = (mat: THREE.MeshStandardMaterial, canvas: HTMLCanvasElement) => {
    mat.map?.dispose();
    const texture = new THREE.CanvasTexture(canvas);
    texture.flipY = false; // glTF standard
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    mat.map = texture;
    mat.color.set(0xffffff); // Neutral white base so texture colors appear vibrant
    mat.needsUpdate = true;
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
    // PCFSoftShadowMap was removed from three.js (it fell back to this one with a warning)
    renderer.shadowMap.type = THREE.PCFShadowMap;
    // No tone mapping: ACES and Neutral both crush dark colours (navy came out black), the kit colours must stay true
    renderer.toneMapping = THREE.NoToneMapping;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Orbit Controls with Turntable Lock
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 4.2;
    controls.minDistance = 0.8;
    controls.target.set(0, 0.1, 0);

    // Lock polar angle so model does NOT flip or tilt upside down (the middle-button drag below moves this band)
    controls.minPolarAngle = Math.PI * 0.48;
    controls.maxPolarAngle = Math.PI * 0.52;
    // the middle button tilts the view instead of zooming (the wheel still zooms)
    controls.mouseButtons = { ...controls.mouseButtons, MIDDLE: null };

    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 2.0;
    // wheel zoom speed from the View menu
    controls.zoomSpeed = zoomFactor();
    const offPrefs = onPrefsChange(() => (controls.zoomSpeed = zoomFactor()));
    controlsRef.current = controls;

    // Custom Pointer Drag: Left-click vertical movement moves model up & down (Vertical Panning)
    let isPointerDown = false;
    let startY = 0;

    // Middle-button (wheel button) drag: tilt the camera to look from above or below
    let isTilting = false;
    let tiltY = 0;
    const setTilt = (polar: number) => {
      const t = THREE.MathUtils.clamp(polar, Math.PI * 0.15, Math.PI * 0.85);
      controls.minPolarAngle = t - Math.PI * 0.02;
      controls.maxPolarAngle = t + Math.PI * 0.02;
      controls.update();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0) { // Left click
        isPointerDown = true;
        startY = e.clientY;
      } else if (e.button === 1) {
        isTilting = true;
        tiltY = e.clientY;
        e.preventDefault();
      }
    };
    // no browser auto-scroll on a middle click over the 3D view
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (isTilting) {
        const dy = e.clientY - tiltY;
        tiltY = e.clientY;
        // dragging down looks from higher up
        setTilt((controls.minPolarAngle + controls.maxPolarAngle) / 2 - dy * 0.006);
        return;
      }
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
      isTilting = false;
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
    domElem.addEventListener('mousedown', onMouseDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // Lighting: neutral white lights, balanced so a surface facing the camera (front or back) shows about
    // the texture's own colour, like the flat texture view of the CometKIT Blender scene; the sides fall off.
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
    keyLight.position.set(2, 3, 2.5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    fillLight.position.set(-2.5, 1.5, 1.5);
    scene.add(fillLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 1.45);
    backLight.position.set(-1.5, 2.5, -2.5);
    scene.add(backLight);

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
          // matte cloth: a glossier value adds white highlights that wash bright kit colours out
          roughness: 0.9,
          metalness: 0,
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

        applyModelChoice(model, choiceRef.current);

        // Center and scale model to fit view nicely (default parts, so switching parts never moves the view)
        const box = new THREE.Box3();
        applyModelChoice(model, modelChoiceFromConfig(DEFAULT_KIT_CONFIG, DEFAULT_PREVIEW));
        model.traverse((o) => {
          if ((o as THREE.Mesh).isMesh && o.visible) box.expandByObject(o);
        });
        applyModelChoice(model, choiceRef.current);
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
        if (textureCanvasRef.current) {
          applyTextureToMaterial(kitMat, textureCanvasRef.current);
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
      offPrefs();
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      container.removeEventListener('pointerdown', onZonePointerDown, true);
      window.removeEventListener('pointermove', onZonePointerMove);
      window.removeEventListener('pointerup', onZonePointerUp);
      domElem.removeEventListener('pointerdown', onPointerDown);
      domElem.removeEventListener('mousedown', onMouseDown);
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
    if (!kitMaterialRef.current || !textureCanvas) return;
    applyTextureToMaterial(kitMaterialRef.current, textureCanvas);
  }, [textureCanvas]);

  // Model parts: collar, sleeves, shorts, socks
  useEffect(() => {
    if (kitMeshGroupRef.current) applyModelChoice(kitMeshGroupRef.current, choiceRef.current);
  }, [choiceKey]);

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
    controls.minPolarAngle = Math.PI * 0.48;
    controls.maxPolarAngle = Math.PI * 0.52;

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
                  ? 'bg-sky-500/25 text-sky-100'
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
                ? 'bg-sky-500/25 text-sky-100 font-bold'
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

      {/* Preview-only parts (the game takes these from the player): one button, the choices in a popup above it */}
      <div ref={previewMenuRef} className="absolute bottom-2 left-3 z-20">
        {previewOpen && (
          <div
            role="dialog"
            aria-label="Pakaian di preview"
            className="absolute left-0 bottom-full mb-1.5 w-64 rounded-xl border border-slate-700 bg-[#161a26] shadow-2xl shadow-black/50 p-1.5"
          >
            {(
              [
                ['Lengan', 'sleeves', [['short', 'Pendek'], ['long', 'Panjang'], ['gk', 'Kiper']]],
                ['Kaus kaki', 'socks', [['short', 'Pendek'], ['middle', 'Sedang'], ['long', 'Panjang']]],
              ] as const
            ).map(([heading, key, options]) => (
              <div key={key} role="group" aria-label={heading}>
                <MenuHeading>{heading}</MenuHeading>
                <div className="grid grid-cols-3 gap-0.5 p-1">
                  {options.map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setPreviewKey(key, value as never)}
                      aria-pressed={preview[key] === value}
                      className={`h-7 rounded-md text-[11px] font-semibold transition-colors ${
                        preview[key] === value ? 'bg-sky-500/25 text-sky-100' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <MenuSeparator />
            {(
              [
                ['captain', 'Ban kapten', 'Memakai area Ban Kapten di template'],
                ['tucked', 'Baju dimasukkan', 'Baju dimasukkan ke celana'],
              ] as const
            ).map(([key, label, hint]) => (
              <button
                key={key}
                role="switch"
                aria-checked={preview[key]}
                onClick={() => setPreviewKey(key, !preview[key])}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-slate-800"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-medium text-slate-200">{label}</span>
                  <span className="block text-[10px] text-slate-500">{hint}</span>
                </span>
                <span className={`w-7 h-4 rounded-full p-0.5 transition-colors ${preview[key] ? 'bg-sky-500' : 'bg-slate-600'}`}>
                  <span className={`block w-3 h-3 rounded-full bg-white transition-transform ${preview[key] ? 'translate-x-3' : ''}`} />
                </span>
              </button>
            ))}
            <p className="px-2 pt-1 pb-0.5 text-[10px] text-slate-500">Hanya untuk preview: game mengambil ini dari pemain.</p>
          </div>
        )}
        <button
          onClick={() => setPreviewOpen((o) => !o)}
          aria-expanded={previewOpen}
          aria-haspopup="dialog"
          title="Lengan, kaus kaki, ban kapten, baju dimasukkan"
          className={`h-8 flex items-center gap-1.5 pl-2 pr-2.5 rounded-lg border shadow-xl backdrop-blur-md text-[11px] font-semibold transition-colors ${
            previewOpen ? 'bg-sky-500/20 border-sky-500/50 text-sky-100' : 'bg-[#121622]/90 border-slate-800 text-slate-300 hover:text-white'
          }`}
        >
          <Shirt className="w-3.5 h-3.5" />
          <span>Pakaian</span>
          <span className="text-slate-500 font-medium hidden sm:inline">{previewSummary}</span>
          <ChevronUp className={`w-3.5 h-3.5 transition-transform ${previewOpen ? '' : 'rotate-180'}`} />
        </button>
      </div>

      {/* Bottom hint (short, hidden on small windows) */}
      <div className="absolute bottom-2 right-3 pointer-events-none z-10 hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/70 backdrop-blur-md border border-slate-800/80 text-[10px] text-slate-400 whitespace-nowrap">
        <ArrowUpDown className="w-3 h-3 text-sky-400" />
        <span>Seret: putar &bull; Tombol tengah: miringkan &bull; Scroll: zoom</span>
      </div>
    </div>
  );
};

export default Kit3DViewer;