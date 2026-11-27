import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { NOTE_ORDER, NoteId, OCARINA_NOTES } from './musicData';
import {
  applyHoleTouchImpulse,
  createOcarinaPhysicsState,
  OcarinaPhysicsState,
  stepOcarinaPhysics,
} from './physics';
import type { LeaderboardEntry } from '../services/leaderboardService';
import {
  CatRig,
  createCompanionCat,
  createMoonlitVillageAndFishermen,
  createMusicianCharacter,
  MusicianRig,
  updateCatRig,
  updateMusicianRig,
  VillagePropsRig,
} from './characterModels';

export type CameraFocusMode = 'title' | 'playing' | 'scoreboard';

interface ParticleSlot {
  active: boolean;
  age: number;
  maxAge: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  scale: number;
  color: THREE.Color;
}

// Pre-allocated scratch math helpers (Zero-GC in render loop)
const _vec3 = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _mat4 = new THREE.Matrix4();
const _scaleVec = new THREE.Vector3();
const _color = new THREE.Color();
const _euler = new THREE.Euler();

function createProceduralStoneBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = 90 + Math.floor(Math.random() * 80);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 3 + Math.random() * 5, 2 + Math.random() * 4);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
  grad.addColorStop(0, 'rgba(6, 12, 20, 0.85)');
  grad.addColorStop(0.55, 'rgba(6, 12, 20, 0.35)');
  grad.addColorStop(1, 'rgba(6, 12, 20, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function createSkyGradientTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#040514');
  grad.addColorStop(0.32, '#0e0b2e');
  grad.addColorStop(0.58, '#261459');
  grad.addColorStop(0.76, '#391b72');
  grad.addColorStop(1, '#101d47');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const WATER_LEVEL = -0.38;
const ISLAND_TOP_Y = 0.36;

export interface SceneCallbacks {
  onHolePress: (note: NoteId) => void;
  onHoleRelease: (note: NoteId) => void;
  onDragTilt: (tx: number, ty: number) => void;
}

export class OcarinaSceneController {
  private container: HTMLElement | null = null;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private isSoftwareGl = false;

  private ocarinaRoot!: THREE.Group;
  private ocarinaBodyGroup!: THREE.Group;
  private fairyGroup!: THREE.Group;
  private fairyWings: THREE.Mesh[] = [];
  private rupeeMeshes: THREE.Mesh[] = [];
  private auraRingMesh!: THREE.Mesh;
  private auraLight!: THREE.PointLight;
  private pillarRunes: THREE.Mesh[] = [];
  private musicianRig!: MusicianRig;
  private catRig!: CatRig;
  private villageRig!: VillagePropsRig;

  private holeButtonMeshes = new Map<NoteId, THREE.Mesh>();
  private holeGlowRings = new Map<NoteId, THREE.Mesh>();
  private holeHitTargets: THREE.Mesh[] = [];

  private scoreboardCanvas!: HTMLCanvasElement;
  private scoreboardTex!: THREE.CanvasTexture;

  private particleInstanced!: THREE.InstancedMesh;
  private particlePool: ParticleSlot[] = [];
  private particleCursor = 0;

  private physics: OcarinaPhysicsState = createOcarinaPhysicsState();
  private heldNotes = new Set<NoteId>();
  private pointerHoleMap = new Map<number, NoteId>();
  private tiltPointerId: number | null = null;
  private dragStart = { x: 0, y: 0 };

  private waterRipples!: THREE.InstancedMesh;
  private rippleCount = 54;
  private rippleMeta: Array<{ x: number; z: number; baseW: number; phase: number; isGold: boolean }> = [];
  private cameraMode: CameraFocusMode = 'title';
  private camPosCurrent = new THREE.Vector3(0.05, 1.65, 3.6);
  private camLookCurrent = new THREE.Vector3(0.1, 0.96, -0.3);
  private shakeTrauma = 0;
  private hitstopTimer = 0;
  private auraBoost = 0;
  private auraColor = new THREE.Color('#38bdf8');
  private pitchShiftVisual = 0;
  private comboLevel = 0;

  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();
  private clock = new THREE.Clock();
  private elapsed = 0;
  private frameId = 0;
  private disposed = false;

  private callbacks: SceneCallbacks;
  private resizeObserver: ResizeObserver | null = null;

  constructor(callbacks: SceneCallbacks) {
    this.callbacks = callbacks;
    this.raycaster.layers.set(1);
  }

  public mount(container: HTMLElement): void {
    this.container = container;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: this.isSoftwareGl,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.setAttribute('data-testid', 'ocarina-canvas');
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = createSkyGradientTexture();
    this.scene.fog = new THREE.FogExp2(0x0c0b29, 0.016);
    this.scene.environmentIntensity = 0.22;

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 160);
    this.camera.position.copy(this.camPosCurrent);
    this.camera.lookAt(this.camLookCurrent);

    this.buildLighting();
    this.buildWorldClearing();
    this.buildCharactersAndVillage();
    this.buildOcarinaHero();
    this.buildFairyCompanion();
    this.buildScoreboardMonolith();
    this.buildParticlePool();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindPointerEvents();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
    window.addEventListener('resize', this.handleResize);
    window.visualViewport?.addEventListener('resize', this.handleResize);

    this.clock.start();
    this.tick();
  }

  private buildLighting(): void {
    const hemi = new THREE.HemisphereLight(0x4f46e5, 0x0d1024, 0.55);
    this.scene.add(hemi);

    // Warm golden streetlamp / lantern key light matching the reference character & cat glow
    const warmKeyLight = new THREE.DirectionalLight(0xffa94d, 2.75);
    warmKeyLight.position.set(-2.4, 5.0, 5.6);
    warmKeyLight.castShadow = true;
    warmKeyLight.shadow.mapSize.width = 1024;
    warmKeyLight.shadow.mapSize.height = 1024;
    warmKeyLight.shadow.camera.near = 1;
    warmKeyLight.shadow.camera.far = 26;
    const d = 8;
    warmKeyLight.shadow.camera.left = -d;
    warmKeyLight.shadow.camera.right = d;
    warmKeyLight.shadow.camera.top = d;
    warmKeyLight.shadow.camera.bottom = -d;
    warmKeyLight.shadow.bias = -0.0005;
    warmKeyLight.shadow.normalBias = 0.02;
    this.scene.add(warmKeyLight);

    // Cool indigo-violet moonlight rim from behind
    const moonRim = new THREE.DirectionalLight(0x6366f1, 0.85);
    moonRim.position.set(4.5, 6.0, -7.5);
    this.scene.add(moonRim);

    this.auraLight = new THREE.PointLight(0x38bdf8, 0.85, 6.5, 2);
    this.auraLight.position.set(0.42, 1.35, 0.75);
    this.scene.add(this.auraLight);
  }

  private buildWorldClearing(): void {
    const bumpTex = createProceduralStoneBumpTexture();
    bumpTex.repeat.set(3, 3);

    // 1. Broad Moonlit Deep Indigo Water Plane
    const waterGeo = new THREE.PlaneGeometry(130, 130, 1, 1);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x07143a,
      emissive: 0x030a24,
      emissiveIntensity: 0.65,
      roughness: 0.36,
      metalness: 0.34,
      flatShading: true,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.y = WATER_LEVEL;
    waterMesh.receiveShadow = true;
    this.scene.add(waterMesh);

    // Instanced golden-amber & cyan water reflection ripples (matching left-side village reflection)
    const rippleGeo = new THREE.PlaneGeometry(1, 0.08);
    rippleGeo.rotateX(-Math.PI / 2);
    const rippleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.84,
    });
    this.waterRipples = new THREE.InstancedMesh(rippleGeo, rippleMat, this.rippleCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.rippleCount; i++) {
      const lane = i % 3;
      const rx = -0.85 - (i % 7) * 0.48 - lane * 0.35 + Math.sin(i * 3.1) * 0.25;
      const rz = 0.6 - Math.floor(i / 3) * 0.52;
      const baseW = 0.34 + (i % 5) * 0.16;
      const isGold = i % 5 !== 0;
      this.rippleMeta.push({ x: rx, z: rz, baseW, phase: i * 0.73, isGold });
      dummy.position.set(rx, WATER_LEVEL + 0.014, rz);
      dummy.scale.set(baseW, 1, 1);
      dummy.updateMatrix();
      this.waterRipples.setMatrixAt(i, dummy.matrix);
      _color.setHex(isGold ? (i % 2 === 0 ? 0xf59e0b : 0xfbbf24) : 0x38bdf8);
      this.waterRipples.setColorAt(i, _color);
    }
    this.waterRipples.computeBoundingSphere();
    this.scene.add(this.waterRipples);

    // 2. Curved Stone Island Terrace (front-left cliff edge stops right under Musician's hips at z≈0.18)
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x423a42,
      roughness: 0.9,
      metalness: 0.04,
      flatShading: true,
      bumpMap: bumpTex,
      bumpScale: 0.04,
    });
    const darkCliffMat = new THREE.MeshStandardMaterial({
      color: 0x1e2230,
      roughness: 0.94,
      metalness: 0.03,
      flatShading: true,
    });
    const parapetMat = new THREE.MeshStandardMaterial({
      color: 0x333547,
      roughness: 0.88,
      metalness: 0.05,
      flatShading: true,
    });

    const islandGroup = new THREE.Group();
    // Main curved cobblestone island terrace (sits cleanly behind Musician's legs while supporting Cat & tower)
    const cliffBody = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.26, 0.72, 18), darkCliffMat);
    cliffBody.position.set(2.18, 0.0, -1.55);
    cliffBody.scale.set(1.14, 1, 0.86);
    cliffBody.castShadow = true;
    cliffBody.receiveShadow = true;
    islandGroup.add(cliffBody);

    const terraceDeck = new THREE.Mesh(new THREE.CylinderGeometry(2.20, 2.18, 0.14, 18), stoneMat);
    terraceDeck.position.set(2.18, ISLAND_TOP_Y - 0.06, -1.55);
    terraceDeck.scale.set(1.14, 1, 0.86);
    terraceDeck.receiveShadow = true;
    islandGroup.add(terraceDeck);

    // Curved front seat lip directly beneath Musician's hips (stops behind shins so BOTH legs hang freely over water)
    const frontSeatLip = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 1.00, 0.74, 18), darkCliffMat);
    frontSeatLip.position.set(0.58, 0.0, -0.82);
    frontSeatLip.scale.set(0.96, 1, 0.86);
    frontSeatLip.castShadow = true;
    frontSeatLip.receiveShadow = true;
    islandGroup.add(frontSeatLip);

    const frontSeatCap = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.96, 0.12, 18), stoneMat);
    frontSeatCap.position.set(0.58, ISLAND_TOP_Y - 0.05, -0.82);
    frontSeatCap.scale.set(0.96, 1, 0.86);
    frontSeatCap.receiveShadow = true;
    islandGroup.add(frontSeatCap);

    // Subtle resonance ring (invisible at rest, pulses brightly when completing a Zelda song)
    const runeRingMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x22d3ee,
      emissiveIntensity: 0.0,
      transparent: true,
      opacity: 0.0,
      roughness: 0.25,
      metalness: 0.4,
    });
    this.auraRingMesh = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.50, 8), runeRingMat);
    this.auraRingMesh.rotation.x = -Math.PI / 2;
    this.auraRingMesh.position.set(0.42, ISLAND_TOP_Y + 0.015, -0.14);
    islandGroup.add(this.auraRingMesh);

    // Soft contact shadows beneath Cat
    const shadowTex = createContactShadowTexture();
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
    });
    const catShadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), shadowMat);
    catShadow.rotation.x = -Math.PI / 2;
    catShadow.position.set(1.58, ISLAND_TOP_Y + 0.012, -0.12);
    islandGroup.add(catShadow);

    // 3. Detailed Medieval Stone Tower, Archway Corbels, Lantern & Ivy on Right Edge
    const towerGroup = new THREE.Group();
    towerGroup.position.set(3.25, 0, -0.45);
    towerGroup.rotation.y = -0.18;

    const towerPlinth = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.72, 1.78), darkCliffMat);
    towerPlinth.position.y = 0.28;
    towerPlinth.receiveShadow = true;
    towerGroup.add(towerPlinth);

    const rightTower = new THREE.Mesh(new THREE.BoxGeometry(1.45, 4.8, 1.55), stoneMat);
    rightTower.position.y = 2.05;
    rightTower.castShadow = true;
    rightTower.receiveShadow = true;
    towerGroup.add(rightTower);

    // Carved corner masonry quoins / pilasters + mid-belt cornice
    for (const [qx, qz] of [
      [-0.72, 0.77],
      [0.72, 0.77],
      [-0.72, -0.77],
    ] as const) {
      const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.7, 0.18), parapetMat);
      pilaster.position.set(qx, 2.0, qz);
      pilaster.castShadow = true;
      towerGroup.add(pilaster);
    }

    const towerCornice = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.18, 1.72), parapetMat);
    towerCornice.position.y = 2.42;
    towerGroup.add(towerCornice);

    // Recessed warm amber gothic slit window on the tower face
    const slitFrame = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.62, 0.10), darkCliffMat);
    slitFrame.position.set(-0.74, 2.95, 0.08);
    slitFrame.rotation.y = Math.PI / 2;
    const slitGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 0.48, 0.12),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.8,
        roughness: 0.3,
      }),
    );
    slitGlow.position.set(-0.75, 2.95, 0.08);
    slitGlow.rotation.y = Math.PI / 2;
    towerGroup.add(slitFrame, slitGlow);

    // Wrought-iron hanging lantern bracket on tower wall above the Cat
    const towerIronMat = new THREE.MeshStandardMaterial({ color: 0x161b26, roughness: 0.45, metalness: 0.65 });
    const lBracket = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.06), towerIronMat);
    lBracket.position.set(-0.88, 2.02, 0.35);
    const lCage = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.10, 6), towerIronMat);
    lCage.position.set(-1.02, 1.92, 0.35);
    const lCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.055, 0.14, 6),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 2.0 }),
    );
    lCore.position.set(-1.02, 1.82, 0.35);
    towerGroup.add(lBracket, lCage, lCore);

    islandGroup.add(towerGroup);

    const archBeam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.55, 1.1), parapetMat);
    archBeam.position.set(2.05, 3.15, -0.85);
    archBeam.rotation.z = -0.14;
    archBeam.castShadow = true;
    const archTrim = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.14, 1.22), stoneMat);
    archTrim.position.set(2.05, 3.42, -0.85);
    archTrim.rotation.z = -0.14;
    const corbel = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.52), stoneMat);
    corbel.position.set(2.58, 2.82, -0.78);
    corbel.rotation.z = 0.55;
    islandGroup.add(archBeam, archTrim, corbel);

    // Rear low stone parapet wall with carved capstones, pilasters & creeping ivy + blossoms
    const backWallGroup = new THREE.Group();
    backWallGroup.position.set(1.75, ISLAND_TOP_Y, -1.85);
    backWallGroup.rotation.y = -0.25;

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.52, 0.46), parapetMat);
    backWall.position.y = 0.26;
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    backWallGroup.add(backWall);

    for (let i = -2; i <= 2; i++) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.10, 0.54), stoneMat);
      cap.position.set(i * 0.45, 0.56, 0);
      backWallGroup.add(cap);
    }
    for (const px of [-1.02, 0, 1.02]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.58, 0.52), stoneMat);
      rib.position.set(px, 0.29, 0);
      backWallGroup.add(rib);
    }
    islandGroup.add(backWallGroup);

    // Sculpted multi-petal glowing purple flowers with green leaf rosettes & stems
    const flowerPetalMat = new THREE.MeshStandardMaterial({
      color: 0xd946ef,
      emissive: 0xa21caf,
      emissiveIntensity: 0.72,
      roughness: 0.38,
    });
    const flowerCenterMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.9,
      roughness: 0.3,
    });
    const leafPatchMat = new THREE.MeshStandardMaterial({
      color: 0x22683f,
      roughness: 0.86,
      metalness: 0.02,
    });
    const leafGeo = new THREE.SphereGeometry(0.075, 8, 6);
    leafGeo.scale(1.4, 0.38, 0.85);
    const petalGeo = new THREE.SphereGeometry(0.038, 8, 6);
    petalGeo.scale(1.2, 0.45, 0.85);

    for (let i = 0; i < 6; i++) {
      const fx = 1.02 + i * 0.29;
      const fz = -1.26 - (i % 2) * 0.18;
      const fGroup = new THREE.Group();
      fGroup.position.set(fx, ISLAND_TOP_Y, fz);

      for (let l = 0; l < 4; l++) {
        const ang = l * (Math.PI / 2) + i * 0.4;
        const leaf = new THREE.Mesh(leafGeo, leafPatchMat);
        leaf.position.set(Math.cos(ang) * 0.075, 0.035, Math.sin(ang) * 0.075);
        leaf.rotation.y = -ang;
        leaf.rotation.z = 0.2;
        fGroup.add(leaf);
      }

      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.15, 6), leafPatchMat);
      stem.position.y = 0.08;
      fGroup.add(stem);

      const head = new THREE.Group();
      head.position.y = 0.16;
      head.rotation.x = 0.25;
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), flowerCenterMat);
      head.add(center);
      for (let p = 0; p < 5; p++) {
        const pang = (p / 5) * Math.PI * 2;
        const petal = new THREE.Mesh(petalGeo, flowerPetalMat);
        petal.position.set(Math.cos(pang) * 0.042, 0, Math.sin(pang) * 0.042);
        petal.rotation.y = -pang;
        head.add(petal);
      }
      fGroup.add(head);
      islandGroup.add(fGroup);
    }

    // Connected stone bridge extending right to the Scoreboard Monolith pier
    const bridgeToScore = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.68, 1.8), darkCliffMat);
    bridgeToScore.position.set(4.6, 0.0, -1.55);
    bridgeToScore.rotation.y = 0.25;
    bridgeToScore.receiveShadow = true;
    islandGroup.add(bridgeToScore);

    this.scene.add(islandGroup);

    // 4. Two Rune Lantern Posts flanking the right Scoreboard Pier
    const pillarBaseGeo = new THREE.CylinderGeometry(0.24, 0.30, 0.35, 6);
    const pillarShaftGeo = new THREE.CylinderGeometry(0.16, 0.20, 1.55, 6);
    const runeBandGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.16, 6);
    for (const [px, pz] of [
      [3.95, -2.95],
      [6.85, -1.65],
    ]) {
      const pGroup = new THREE.Group();
      const base = new THREE.Mesh(pillarBaseGeo, parapetMat);
      base.position.y = 0.17;
      const shaft = new THREE.Mesh(pillarShaftGeo, stoneMat);
      shaft.position.y = 1.05;
      const rune = new THREE.Mesh(
        runeBandGeo,
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0ea5e9,
          emissiveIntensity: 0.9,
          roughness: 0.3,
        }),
      );
      rune.position.y = 1.85;
      this.pillarRunes.push(rune);
      pGroup.add(base, shaft, rune);
      pGroup.position.set(px, ISLAND_TOP_Y, pz);
      this.scene.add(pGroup);
    }

    // 5. Starry Nocturnal Sky Dome (Instanced star specks across indigo/purple sky)
    const starCount = 130;
    const starGeo = new THREE.OctahedronGeometry(0.085, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xfefce8 });
    const stars = new THREE.InstancedMesh(starGeo, starMat, starCount);
    for (let i = 0; i < starCount; i++) {
      const phi = -Math.PI * 0.85 + (i / starCount) * Math.PI * 0.95;
      const r = 24 + (i % 7) * 3.8;
      const sx = Math.sin(phi) * r - 1.5;
      const sz = -Math.cos(phi) * r - 4;
      const sy = 2.5 + ((i * 7) % 13) * 1.15;
      const sc = 0.45 + (i % 4) * 0.35;
      dummy.position.set(sx, sy, sz);
      dummy.rotation.set(i, i * 0.5, 0);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      stars.setMatrixAt(i, dummy.matrix);
    }
    stars.computeBoundingSphere();
    this.scene.add(stars);
  }

  private buildCharactersAndVillage(): void {
    // 1. Chibi Low-Poly Musician seated directly on front-left curved island lip (legs dangling over water)
    this.musicianRig = createMusicianCharacter(false);
    this.musicianRig.root.position.set(0.42, ISLAND_TOP_Y, -0.02);
    this.musicianRig.root.rotation.y = 0.06;
    this.scene.add(this.musicianRig.root);

    // 2. Larger Companion Cat seated right beside Musician on the stone terrace
    this.catRig = createCompanionCat();
    this.catRig.root.position.set(1.58, ISLAND_TOP_Y, -0.10);
    this.catRig.root.rotation.y = -0.22;
    this.catRig.root.scale.setScalar(1.24);
    this.scene.add(this.catRig.root);

    // 3. Distant Stone Quay with 2 Fishing Villagers & Silhouetted Lakeside Village
    this.villageRig = createMoonlitVillageAndFishermen();
    this.scene.add(this.villageRig.root);
  }

  private buildOcarinaHero(): void {
    this.ocarinaRoot = new THREE.Group();
    // Nestled right inside the Musician's hands (scaled proportionally like reference!)
    this.ocarinaRoot.position.set(0.42, 0.88, 0.34);
    this.ocarinaRoot.scale.setScalar(0.26);

    this.ocarinaBodyGroup = new THREE.Group();
    // Tilt slightly toward camera so all 5 top holes remain clearly visible & clickable
    this.ocarinaBodyGroup.rotation.x = 0.48;
    this.ocarinaRoot.add(this.ocarinaBodyGroup);

    const ceramicMat = new THREE.MeshStandardMaterial({
      color: 0x1e4fd6,
      roughness: 0.24,
      metalness: 0.08,
      flatShading: true,
    });

    const goldBandMat = new THREE.MeshStandardMaterial({
      color: 0xf4c44e,
      roughness: 0.18,
      metalness: 0.92,
      flatShading: true,
    });

    const darkCavityMat = new THREE.MeshStandardMaterial({
      color: 0x09101c,
      roughness: 0.9,
      metalness: 0.1,
    });

    // 1. Primary sculpted teardrop ceramic body using low-poly LatheGeometry (14 radial segs)
    const profile: THREE.Vector2[] = [
      new THREE.Vector2(0.01, -1.15),
      new THREE.Vector2(0.26, -1.04),
      new THREE.Vector2(0.54, -0.78),
      new THREE.Vector2(0.76, -0.35),
      new THREE.Vector2(0.84, 0.12),
      new THREE.Vector2(0.76, 0.54),
      new THREE.Vector2(0.54, 0.86),
      new THREE.Vector2(0.26, 1.04),
      new THREE.Vector2(0.01, 1.12),
    ];
    const bodyGeo = new THREE.LatheGeometry(profile, 14);
    bodyGeo.rotateZ(Math.PI / 2); // Align main axis along X
    bodyGeo.scale(1.0, 0.46, 0.72); // Classic flattened teardrop shell
    bodyGeo.computeVertexNormals();
    const bodyMesh = new THREE.Mesh(bodyGeo, ceramicMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.ocarinaBodyGroup.add(bodyMesh);

    // 2. Mouthpiece stem extending back-left (ExtrudeGeometry with bevel)
    const mouthShape = new THREE.Shape();
    mouthShape.moveTo(-0.14, -0.09);
    mouthShape.lineTo(0.14, -0.09);
    mouthShape.lineTo(0.11, 0.09);
    mouthShape.lineTo(-0.11, 0.09);
    mouthShape.closePath();

    const mouthGeo = new THREE.ExtrudeGeometry(mouthShape, {
      depth: 0.62,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.025,
      bevelSegments: 2,
    });
    mouthGeo.rotateY(-Math.PI / 2);
    const mouthMesh = new THREE.Mesh(mouthGeo, ceramicMat);
    mouthMesh.position.set(-0.62, 0.0, 0.34);
    mouthMesh.rotation.y = 0.58;
    mouthMesh.castShadow = true;
    this.ocarinaBodyGroup.add(mouthMesh);

    // 3. Metallic Gold Collar Band + Silver Trim Rings around mouthpiece neck
    const silverTrimMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.22,
      metalness: 0.9,
      flatShading: true,
    });

    const collarGeo = new THREE.CylinderGeometry(0.175, 0.195, 0.14, 8);
    collarGeo.rotateZ(Math.PI / 2);
    collarGeo.scale(1, 0.85, 1.15);
    const collarMesh = new THREE.Mesh(collarGeo, goldBandMat);
    collarMesh.position.set(-0.84, 0.0, 0.48);
    collarMesh.rotation.y = 0.58;
    collarMesh.castShadow = true;
    this.ocarinaBodyGroup.add(collarMesh);

    const trimGeo = new THREE.CylinderGeometry(0.184, 0.184, 0.025, 8);
    trimGeo.rotateZ(Math.PI / 2);
    trimGeo.scale(1, 0.87, 1.17);
    const trimFront = new THREE.Mesh(trimGeo, silverTrimMat);
    trimFront.position.set(-0.78, 0.0, 0.44);
    trimFront.rotation.y = 0.58;
    const trimBack = new THREE.Mesh(trimGeo, silverTrimMat);
    trimBack.position.set(-0.90, 0.0, 0.52);
    trimBack.rotation.y = 0.58;
    this.ocarinaBodyGroup.add(trimFront, trimBack);

    // 4. Raised 3-Triangle Golden Triforce Crest on top of the mouthpiece collar
    const triShape = new THREE.Shape();
    triShape.moveTo(0, 0.085);
    triShape.lineTo(-0.075, -0.045);
    triShape.lineTo(0.075, -0.045);
    triShape.closePath();
    const triGeo = new THREE.ExtrudeGeometry(triShape, {
      depth: 0.035,
      bevelEnabled: false,
    });

    const triforceGroup = new THREE.Group();
    const triTop = new THREE.Mesh(triGeo, goldBandMat);
    triTop.position.set(0, 0.07, 0);
    const triLeft = new THREE.Mesh(triGeo, goldBandMat);
    triLeft.position.set(-0.078, -0.06, 0);
    const triRight = new THREE.Mesh(triGeo, goldBandMat);
    triRight.position.set(0.078, -0.06, 0);
    triforceGroup.add(triTop, triLeft, triRight);
    triforceGroup.position.set(-0.84, 0.165, 0.48);
    triforceGroup.rotation.set(-Math.PI / 2 + 0.12, 0, 0.58);
    this.ocarinaBodyGroup.add(triforceGroup);

    // 5. Fipple Windway & Acoustic Sound-Hole Slot + Authentic 12-hole Sub-Vents
    const fippleWindow = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.04, 0.09),
      darkCavityMat,
    );
    fippleWindow.position.set(-0.71, 0.16, 0.39);
    fippleWindow.rotation.y = 0.58;
    this.ocarinaBodyGroup.add(fippleWindow);

    const slotMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.06, 0.14),
      darkCavityMat,
    );
    slotMesh.position.set(-0.35, -0.34, 0.1);
    this.ocarinaBodyGroup.add(slotMesh);

    // Recessed ceramic sub-holes (authentic 12-hole acoustic vents & underside thumb holes)
    const subHoleGeo = new THREE.CylinderGeometry(0.055, 0.065, 0.04, 8);
    const subHoleSpecs: Array<[number, number, number, number, number]> = [
      [-0.42, 0.25, -0.14, -0.15, 0.12], // top-left auxiliary vent
      [0.44, 0.23, 0.21, 0.18, -0.14], // top-right pinky vent
      [-0.08, -0.31, -0.22, 0, 0], // underside left thumb hole
      [0.24, -0.31, -0.18, 0, 0], // underside right thumb hole
      [0.62, 0.20, 0.08, 0.08, -0.22], // far-right tuning vent
    ];
    for (const [sx, sy, sz, rx, rz] of subHoleSpecs) {
      const subHole = new THREE.Mesh(subHoleGeo, darkCavityMat);
      subHole.position.set(sx, sy, sz);
      subHole.rotation.set(rx, 0, rz);
      this.ocarinaBodyGroup.add(subHole);
    }

    // 6. Five Interactive 3D Tone-Hole Valves (Socket + Spring Button + Glow Ring + Raycast Proxy)
    const socketGeo = new THREE.CylinderGeometry(0.145, 0.16, 0.07, 8);
    const buttonGeo = new THREE.CylinderGeometry(0.105, 0.12, 0.09, 8);
    const glowRingGeo = new THREE.RingGeometry(0.14, 0.185, 8);
    const hitProxyGeo = new THREE.SphereGeometry(0.24, 8, 8);
    const hitProxyMat = new THREE.MeshBasicMaterial({ visible: false });

    for (const id of NOTE_ORDER) {
      const spec = OCARINA_NOTES[id];
      const holeAnchor = new THREE.Group();
      holeAnchor.position.set(spec.holePos[0], spec.holePos[1], spec.holePos[2]);
      // Conform slightly to curved top shell
      holeAnchor.rotation.z = -spec.holePos[0] * 0.22;
      holeAnchor.rotation.x = spec.holePos[2] * 0.28;

      const socket = new THREE.Mesh(socketGeo, darkCavityMat);
      socket.position.y = 0.01;
      holeAnchor.add(socket);

      const btnMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(spec.colorHex),
        emissive: new THREE.Color(spec.colorHex),
        emissiveIntensity: 0.22,
        roughness: 0.18,
        metalness: 0.28,
        flatShading: true,
      });
      const btn = new THREE.Mesh(buttonGeo, btnMat);
      btn.position.y = 0.06;
      btn.castShadow = true;
      holeAnchor.add(btn);
      this.holeButtonMeshes.set(id, btn);

      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(spec.glowHex),
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(glowRingGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.052;
      holeAnchor.add(ring);
      this.holeGlowRings.set(id, ring);

      // Dedicated raycast target on layer 1
      const proxy = new THREE.Mesh(hitProxyGeo, hitProxyMat);
      proxy.position.y = 0.07;
      proxy.layers.set(1);
      proxy.userData.noteId = id;
      holeAnchor.add(proxy);
      this.holeHitTargets.push(proxy);

      this.ocarinaBodyGroup.add(holeAnchor);
    }

    this.scene.add(this.ocarinaRoot);
  }

  private buildFairyCompanion(): void {
    this.fairyGroup = new THREE.Group();
    this.fairyGroup.position.set(2.2, 1.55, -0.35);
    this.fairyGroup.scale.setScalar(0.55);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 14, 12),
      new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        emissive: 0x38bdf8,
        emissiveIntensity: 2.0,
        roughness: 0.08,
      }),
    );
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.012, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.55 }),
    );
    halo.rotation.x = Math.PI / 2 - 0.35;
    this.fairyGroup.add(core, halo);

    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.bezierCurveTo(0.12, 0.16, 0.30, 0.20, 0.34, 0.08);
    wingShape.bezierCurveTo(0.36, -0.02, 0.22, -0.10, 0, -0.02);
    wingShape.closePath();

    const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.003,
      bevelSegments: 2,
      curveSegments: 8,
    });
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.78,
      roughness: 0.2,
      side: THREE.DoubleSide,
    });

    const configs = [
      { x: 0.04, y: 0.04, ry: -0.35, rz: 0.2, sx: 1 },
      { x: -0.04, y: 0.04, ry: 0.35, rz: -0.2, sx: -1 },
      { x: 0.04, y: -0.03, ry: -0.4, rz: -0.35, sx: 0.76 },
      { x: -0.04, y: -0.03, ry: 0.4, rz: 0.35, sx: -0.76 },
    ];
    for (const c of configs) {
      const w = new THREE.Mesh(wingGeo, wingMat);
      w.position.set(c.x, c.y, -0.02);
      w.rotation.set(0, c.ry, c.rz);
      w.scale.set(c.sx, Math.abs(c.sx), 1);
      w.userData.baseRy = c.ry;
      w.userData.side = c.sx > 0 ? 1 : -1;
      this.fairyWings.push(w);
      this.fairyGroup.add(w);
    }

    this.scene.add(this.fairyGroup);
  }

  private buildScoreboardMonolith(): void {
    const monoGroup = new THREE.Group();
    const mx = 5.4;
    const mz = -1.9;
    monoGroup.position.set(mx, ISLAND_TOP_Y, mz);
    monoGroup.rotation.y = -0.58;

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x506072,
      roughness: 0.82,
      metalness: 0.1,
      flatShading: true,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf4c44e,
      roughness: 0.2,
      metalness: 0.9,
      flatShading: true,
    });

    // Base plinth
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.38, 1.0), stoneMat);
    plinth.position.y = 0.19;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    monoGroup.add(plinth);

    // Main tablet slab
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2.35, 2.75, 0.46), stoneMat);
    slab.position.y = 1.75;
    slab.castShadow = true;
    slab.receiveShadow = true;
    monoGroup.add(slab);

    // Twin side pillars + gabled crown
    const leftCol = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 2.85, 6), stoneMat);
    leftCol.position.set(-1.18, 1.8, 0.1);
    const rightCol = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 2.85, 6), stoneMat);
    rightCol.position.set(1.18, 1.8, 0.1);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 1.55, 0.52, 4), stoneMat);
    crown.rotation.y = Math.PI / 4;
    crown.position.y = 3.38;
    const goldCrest = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), goldMat);
    goldCrest.position.y = 3.78;
    monoGroup.add(leftCol, rightCol, crown, goldCrest);

    // Dynamic Stone Leaderboard CanvasTexture face
    this.scoreboardCanvas = document.createElement('canvas');
    this.scoreboardCanvas.width = 512;
    this.scoreboardCanvas.height = 512;
    this.scoreboardTex = new THREE.CanvasTexture(this.scoreboardCanvas);
    this.scoreboardTex.colorSpace = THREE.SRGBColorSpace;
    this.scoreboardTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    const facePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.02, 2.38),
      new THREE.MeshStandardMaterial({
        map: this.scoreboardTex,
        color: 0xffffff,
        roughness: 0.72,
        metalness: 0.06,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    facePlane.position.set(0, 1.78, 0.255);
    monoGroup.add(facePlane);

    // 3 Podiums with Low-Poly Rupee Trophies in front of monolith
    const rupeeShape = new THREE.Shape();
    rupeeShape.moveTo(0, 0.22);
    rupeeShape.lineTo(0.12, 0.08);
    rupeeShape.lineTo(0.12, -0.08);
    rupeeShape.lineTo(0, -0.22);
    rupeeShape.lineTo(-0.12, -0.08);
    rupeeShape.lineTo(-0.12, 0.08);
    rupeeShape.closePath();
    const rupeeGeo = new THREE.ExtrudeGeometry(rupeeShape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelSize: 0.02,
      bevelThickness: 0.02,
      bevelSegments: 1,
    });
    rupeeGeo.center();

    const trophies = [
      { x: -0.75, h: 0.55, color: 0x34d399 },
      { x: 0.0, h: 0.78, color: 0xfbbf24 },
      { x: 0.75, h: 0.42, color: 0xf87171 },
    ];
    for (const t of trophies) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, t.h, 6), stoneMat);
      pod.position.set(t.x, t.h / 2, 0.92);
      pod.castShadow = true;
      monoGroup.add(pod);

      const rupee = new THREE.Mesh(
        rupeeGeo,
        new THREE.MeshStandardMaterial({
          color: t.color,
          emissive: t.color,
          emissiveIntensity: 0.35,
          roughness: 0.14,
          metalness: 0.45,
          flatShading: true,
        }),
      );
      rupee.position.set(t.x, t.h + 0.36, 0.92);
      rupee.userData.baseY = t.h + 0.36;
      this.rupeeMeshes.push(rupee);
      monoGroup.add(rupee);
    }

    this.updateLeaderboardTexture([]);
    this.scene.add(monoGroup);
  }

  public updateLeaderboardTexture(entries: LeaderboardEntry[]): void {
    if (!this.scoreboardCanvas || !this.scoreboardTex) return;
    const ctx = this.scoreboardCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#152232';
    ctx.fillRect(0, 0, 512, 512);

    // Carved gold border
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 8;
    ctx.strokeRect(16, 16, 480, 480);

    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 30px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('PLACAR GLOBAL', 256, 68);

    ctx.fillStyle = '#60a5fa';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('MESTRES DA OCARINA', 256, 98);

    ctx.strokeStyle = 'rgba(212,175,55,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(48, 118);
    ctx.lineTo(464, 118);
    ctx.stroke();

    if (entries.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('Toque no Modo Desafio', 256, 250);
      ctx.fillText('para gravar sua lenda!', 256, 286);
    } else {
      const top = entries.slice(0, 5);
      top.forEach((entry, idx) => {
        const y = 166 + idx * 64;
        ctx.fillStyle = idx === 0 ? 'rgba(251, 191, 36, 0.16)' : 'rgba(255,255,255,0.04)';
        ctx.fillRect(36, y - 34, 440, 50);

        ctx.textAlign = 'left';
        ctx.fillStyle = idx === 0 ? '#fbbf24' : idx === 1 ? '#e2e8f0' : idx === 2 ? '#f59e0b' : '#93c5fd';
        ctx.font = 'bold 24px monospace';
        ctx.fillText(`#${idx + 1}`, 50, y);

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(entry.playerName.slice(0, 14), 108, y);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#5eead4';
        ctx.font = 'bold 24px monospace';
        ctx.fillText(String(entry.score), 462, y);
      });
    }

    this.scoreboardTex.needsUpdate = true;
  }

  private buildParticlePool(): void {
    const count = 48;
    const geo = new THREE.OctahedronGeometry(0.065, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleInstanced = new THREE.InstancedMesh(geo, mat, count);
    this.particleInstanced.frustumCulled = false;

    for (let i = 0; i < count; i++) {
      this.particlePool.push({
        active: false,
        age: 0,
        maxAge: 1,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        scale: 0,
        color: new THREE.Color(0x5eead4),
      });
      _mat4.makeScale(0, 0, 0);
      this.particleInstanced.setMatrixAt(i, _mat4);
      this.particleInstanced.setColorAt(i, _color.setHex(0x5eead4));
    }
    this.scene.add(this.particleInstanced);
  }

  public spawnNoteBurst(note: NoteId, count = 6): void {
    const spec = OCARINA_NOTES[note];
    const btn = this.holeButtonMeshes.get(note);
    if (!btn) return;
    btn.getWorldPosition(_vec3);

    for (let i = 0; i < count; i++) {
      const slot = this.particlePool[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % this.particlePool.length;
      slot.active = true;
      slot.age = 0;
      slot.maxAge = 0.65 + Math.random() * 0.45;
      slot.x = _vec3.x + (Math.random() - 0.5) * 0.14;
      slot.y = _vec3.y + 0.06;
      slot.z = _vec3.z + (Math.random() - 0.5) * 0.14;
      slot.vx = (Math.random() - 0.5) * 0.85;
      slot.vy = 1.2 + Math.random() * 1.1;
      slot.vz = (Math.random() - 0.5) * 0.85;
      slot.scale = 0.85 + Math.random() * 0.6;
      slot.color.set(spec.glowHex);
    }
  }

  public triggerSongAura(hexColor: string): void {
    this.auraColor.set(hexColor);
    this.auraBoost = 1.0;
    this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.35);
    this.hitstopTimer = 0.045;
    for (const id of NOTE_ORDER) {
      this.spawnNoteBurst(id, 4);
    }
  }

  public setComboLevel(combo: number): void {
    this.comboLevel = combo;
  }

  public setCameraMode(mode: CameraFocusMode): void {
    this.cameraMode = mode;
  }

  public pressHoleVisual(note: NoteId, pressed: boolean): void {
    if (pressed) {
      this.heldNotes.add(note);
      applyHoleTouchImpulse(this.physics, note, true, 1.0);
      this.spawnNoteBurst(note, 5);
    } else {
      this.heldNotes.delete(note);
      applyHoleTouchImpulse(this.physics, note, false, 1.0);
    }
  }

  public setPointerTilt(tx: number, ty: number): void {
    this.physics.pointerTiltX = THREE.MathUtils.clamp(tx, -1, 1);
    this.physics.pointerTiltY = THREE.MathUtils.clamp(ty, -1, 1);
  }

  public setPitchShiftVisual(shift: number): void {
    this.pitchShiftVisual = shift;
    if (this.auraBoost <= 0.05) {
      if (shift > 0) this.auraColor.set('#fbbf24');
      else if (shift < 0) this.auraColor.set('#a78bfa');
      else this.auraColor.set('#38bdf8');
    }
  }

  public getVibratoIntensity(): number {
    return this.physics.vibratoIntensity;
  }

  private bindPointerEvents(): void {
    const dom = this.renderer.domElement;

    const updateNdc = (e: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      updateNdc(e);
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);
      const hits = this.raycaster.intersectObjects(this.holeHitTargets, false);
      if (hits.length > 0) {
        const noteId = hits[0].object.userData.noteId as NoteId | undefined;
        if (noteId) {
          this.pointerHoleMap.set(e.pointerId, noteId);
          dom.setPointerCapture?.(e.pointerId);
          if (e.pointerType === 'touch') {
            try {
              navigator.vibrate?.(8);
            } catch {
              // Ignore vibration restrictions
            }
          }
          this.callbacks.onHolePress(noteId);
          return;
        }
      }
      if (this.tiltPointerId === null) {
        this.tiltPointerId = e.pointerId;
        this.dragStart = { x: e.clientX, y: e.clientY };
        dom.setPointerCapture?.(e.pointerId);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      updateNdc(e);
      if (e.pointerId === this.tiltPointerId) {
        const dx = (e.clientX - this.dragStart.x) / 140;
        const dy = (e.clientY - this.dragStart.y) / 140;
        this.setPointerTilt(dx, dy);
        this.callbacks.onDragTilt(dx, dy);
        return;
      }
      if (this.pointerHoleMap.size === 0 && this.cameraMode === 'title' && e.pointerType !== 'touch') {
        this.setPointerTilt(this.pointerNdc.x * 0.45, this.pointerNdc.y * 0.35);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const releasedNote = this.pointerHoleMap.get(e.pointerId);
      if (releasedNote) {
        this.pointerHoleMap.delete(e.pointerId);
        let stillHeldByOtherPointer = false;
        for (const activeNote of this.pointerHoleMap.values()) {
          if (activeNote === releasedNote) {
            stillHeldByOtherPointer = true;
            break;
          }
        }
        if (!stillHeldByOtherPointer) {
          this.callbacks.onHoleRelease(releasedNote);
        }
      }
      if (e.pointerId === this.tiltPointerId) {
        this.tiltPointerId = null;
        this.setPointerTilt(0, 0);
        this.callbacks.onDragTilt(0, 0);
      }
      try {
        dom.releasePointerCapture?.(e.pointerId);
      } catch {
        // Ignore if not captured
      }
    };

    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('pointercancel', onPointerUp);
  }

  private handleResize = (): void => {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.render(this.scene, this.camera);
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    let polls = 0;
    const poll = () => {
      if (this.disposed) return;
      polls += 1;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED && polls < 40) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (): void => {
    if (this.disposed) return;
    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    this.elapsed += dt;

    // Hitstop freezes simulation physics briefly while rendering & shake continue
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
    } else {
      stepOcarinaPhysics(this.physics, this.heldNotes.size, dt, this.elapsed);
    }

    // Apply spring physics to Ocarina nestled directly in the Musician's hands
    const hoverY = 0.88 + Math.sin(this.elapsed * 2.1) * 0.015 + this.physics.bounceY.value * 0.35;
    this.ocarinaRoot.position.y = hoverY;
    this.ocarinaBodyGroup.rotation.x = 0.48 + this.physics.tiltX.value;
    this.ocarinaBodyGroup.rotation.z = this.physics.tiltZ.value;
    this.ocarinaBodyGroup.rotation.y = this.physics.yaw.value;

    // Depress physical 3D valves & update hole glow rings
    for (const id of NOTE_ORDER) {
      const springVal = this.physics.holes[id].value;
      const btn = this.holeButtonMeshes.get(id);
      const ring = this.holeGlowRings.get(id);
      if (btn) {
        btn.position.y = 0.06 - springVal * 0.048;
        const mat = btn.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.22 + springVal * 1.25;
      }
      if (ring) {
        const ringMat = ring.material as THREE.MeshBasicMaterial;
        ringMat.opacity = 0.16 + springVal * 0.78;
        ring.scale.setScalar(1 + springVal * 0.25);
      }
    }

    // Animate Fairy Companion gentle orbit near right shoulder/cat (clear of top HUD)
    const wingSpeed = 16 + Math.min(20, this.comboLevel * 0.8);
    this.fairyGroup.position.x = 2.05 + Math.cos(this.elapsed * 1.1) * 0.42;
    this.fairyGroup.position.z = -0.35 + Math.sin(this.elapsed * 1.1) * 0.32;
    this.fairyGroup.position.y = 1.56 + Math.sin(this.elapsed * 2.8) * 0.10;
    for (const wing of this.fairyWings) {
      const flap = Math.sin(this.elapsed * wingSpeed) * 0.55;
      wing.rotation.y = (wing.userData.baseRy as number) + flap * (wing.userData.side as number);
    }

    // Animate shimmering water reflections (zero-GC)
    if (this.waterRipples) {
      for (let i = 0; i < this.rippleCount; i++) {
        const m = this.rippleMeta[i];
        const shimmer = 0.72 + Math.sin(this.elapsed * 2.3 + m.phase) * 0.32;
        const driftX = Math.sin(this.elapsed * 1.1 + m.phase) * 0.05;
        _vec3.set(m.x + driftX, WATER_LEVEL + 0.014, m.z);
        _quat.identity();
        _scaleVec.set(m.baseW * shimmer, 1, 1);
        _mat4.compose(_vec3, _quat, _scaleVec);
        this.waterRipples.setMatrixAt(i, _mat4);
      }
      this.waterRipples.instanceMatrix.needsUpdate = true;
    }

    // Animate 3D Characters (Musician, Companion Cat, Fishing Bobber)
    const isPlayingNote = this.heldNotes.size > 0;
    if (this.musicianRig) {
      updateMusicianRig(
        this.musicianRig,
        this.elapsed,
        isPlayingNote,
        this.pitchShiftVisual,
        this.physics.tiltX.value,
        this.physics.tiltZ.value,
      );
    }
    if (this.catRig) {
      updateCatRig(this.catRig, this.elapsed, isPlayingNote, this.comboLevel);
    }
    if (this.villageRig) {
      this.villageRig.bobber.position.y = 0.04 + Math.sin(this.elapsed * 2.4) * 0.025;
      this.villageRig.rodTipGroup.rotation.x = -0.34 + Math.sin(this.elapsed * 1.4) * 0.03;
    }

    // Animate Rupee trophies
    for (let i = 0; i < this.rupeeMeshes.length; i++) {
      const r = this.rupeeMeshes[i];
      r.rotation.y = this.elapsed * 1.6 + i * 1.1;
      r.position.y = (r.userData.baseY as number) + Math.sin(this.elapsed * 2.4 + i) * 0.05;
    }

    // Aura & Pillar Runes decay
    this.auraBoost = Math.max(0, this.auraBoost - dt * 0.75);
    const pitchBoost = this.pitchShiftVisual !== 0 ? 0.55 : 0;
    this.auraLight.color.copy(this.auraColor);
    this.auraLight.intensity =
      0.65 + this.auraBoost * 2.8 + pitchBoost + this.physics.breathPressure * 0.6;
    const auraMat = this.auraRingMesh.material as THREE.MeshStandardMaterial;
    auraMat.emissive.copy(this.auraColor);
    auraMat.emissiveIntensity = this.auraBoost * 2.4;
    auraMat.opacity = Math.min(0.85, this.auraBoost * 1.1);
    for (const rune of this.pillarRunes) {
      const rMat = rune.material as THREE.MeshStandardMaterial;
      rMat.emissive.copy(this.auraColor);
      rMat.emissiveIntensity = 0.7 + this.auraBoost * 1.5;
    }

    // Update Zero-GC Particle Pool
    for (let i = 0; i < this.particlePool.length; i++) {
      const p = this.particlePool[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        _mat4.makeScale(0, 0, 0);
        this.particleInstanced.setMatrixAt(i, _mat4);
        continue;
      }
      const life = 1 - p.age / p.maxAge;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const sc = p.scale * Math.sin(life * Math.PI);
      _vec3.set(p.x, p.y, p.z);
      _euler.set(p.age * 3, p.age * 4, 0);
      _quat.setFromEuler(_euler);
      _scaleVec.set(sc, sc, sc);
      _mat4.compose(_vec3, _quat, _scaleVec);
      this.particleInstanced.setMatrixAt(i, _mat4);
      this.particleInstanced.setColorAt(i, p.color);
    }
    this.particleInstanced.instanceMatrix.needsUpdate = true;
    if (this.particleInstanced.instanceColor) {
      this.particleInstanced.instanceColor.needsUpdate = true;
    }

    // Exponentially damped camera framing tailored for both desktop & Android portrait/landscape
    const isPortrait = this.camera.aspect < 0.92;
    const portraitScale = isPortrait
      ? Math.min(2.35, 0.94 / Math.max(0.42, this.camera.aspect))
      : 1;

    if (this.cameraMode === 'title') {
      const panX = Math.sin(this.elapsed * 0.25) * (isPortrait ? 0.18 : 0.35);
      if (isPortrait) {
        _vec3.set(panX + 0.86, 1.66, 3.65 * portraitScale);
        _vec3B.set(0.92, 1.34, -0.35);
      } else {
        _vec3.set(panX + 0.04, 1.52, 3.85);
        _vec3B.set(-0.08, 0.86, -0.35);
      }
    } else if (this.cameraMode === 'scoreboard') {
      _vec3.set(3.85, 2.35, 2.85 * portraitScale);
      _vec3B.set(5.4, 1.75, -1.9);
    } else if (isPortrait) {
      // Lift Musician + Ocarina + Companion Cat cleanly above the bottom 3x5 mobile keypad
      _vec3.set(0.88, 1.18, 3.55 * portraitScale);
      _vec3B.set(0.92, 0.22, -0.35);
    } else {
      _vec3.set(-0.08, 1.48, 3.62);
      _vec3B.set(0.20, 0.82, -0.35);
    }

    const dampFactor = 1 - Math.exp(-5.2 * dt);
    this.camPosCurrent.lerp(_vec3, dampFactor);
    this.camLookCurrent.lerp(_vec3B, dampFactor);

    // Trauma-squared camera shake
    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 1.8);
    const shake = this.shakeTrauma * this.shakeTrauma * 0.08;
    this.camera.position.set(
      this.camPosCurrent.x + (Math.random() - 0.5) * shake,
      this.camPosCurrent.y + (Math.random() - 0.5) * shake,
      this.camPosCurrent.z,
    );
    this.camera.lookAt(this.camLookCurrent);

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    window.visualViewport?.removeEventListener('resize', this.handleResize);
    this.resizeObserver?.disconnect();

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material?.dispose();
        }
      }
    });
    this.scoreboardTex?.dispose();
    this.renderer?.dispose();
    if (this.renderer?.domElement?.parentElement === this.container) {
      this.container?.removeChild(this.renderer.domElement);
    }
  }
}
