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
  grad.addColorStop(0, '#0a1628');
  grad.addColorStop(0.45, '#132a44');
  grad.addColorStop(0.82, '#1f445c');
  grad.addColorStop(1, '#264d59');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function groundHeightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r < 6.5) return 0;
  const edge = Math.min(1, (r - 6.5) / 14);
  return (
    edge *
    (Math.sin(x * 0.18) * Math.cos(z * 0.16) * 0.85 +
      Math.max(0, (r - 18) * 0.12))
  );
}

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
  private activePointerHole: NoteId | null = null;
  private isDraggingTilt = false;
  private dragStart = { x: 0, y: 0 };

  private cameraMode: CameraFocusMode = 'title';
  private camPosCurrent = new THREE.Vector3(0, 2.2, 5.2);
  private camLookCurrent = new THREE.Vector3(0, 1.05, 0);
  private shakeTrauma = 0;
  private hitstopTimer = 0;
  private auraBoost = 0;
  private auraColor = new THREE.Color('#38bdf8');
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
    this.scene.fog = new THREE.FogExp2(0x16293d, 0.022);

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

    this.clock.start();
    this.tick();
  }

  private buildLighting(): void {
    const hemi = new THREE.HemisphereLight(0x8ac4ff, 0x1b3a2c, 0.9);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffe8b8, 2.15);
    keyLight.position.set(6.5, 11.5, 7.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 32;
    const d = 10;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x52b6ff, 0.9);
    rimLight.position.set(-7, 5, -6);
    this.scene.add(rimLight);

    this.auraLight = new THREE.PointLight(0x38bdf8, 1.4, 8.5, 2);
    this.auraLight.position.set(0, 1.8, 0.6);
    this.scene.add(this.auraLight);
  }

  private buildWorldClearing(): void {
    const bumpTex = createProceduralStoneBumpTexture();
    bumpTex.repeat.set(3, 3);

    // 1. Continuous outdoor low-poly meadow terrain (zero indoor walls)
    const terrainGeo = new THREE.PlaneGeometry(110, 110, 38, 38);
    terrainGeo.rotateX(-Math.PI / 2);
    const posAttr = terrainGeo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const y = groundHeightAt(x, z);
      posAttr.setY(i, y);

      const dist = Math.hypot(x, z);
      const t = Math.min(1, dist / 24);
      _color.setHex(0x28543d).lerp(_color.clone().setHex(0x18342a), t);
      colors[i * 3] = _color.r;
      colors[i * 3 + 1] = _color.g;
      colors[i * 3 + 2] = _color.b;
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.02,
      flatShading: true,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    this.scene.add(terrainMesh);

    // 2. Central stepped octagonal Hylian Stone Altar (3-part composite)
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x5c6b7a,
      roughness: 0.86,
      metalness: 0.08,
      flatShading: true,
      bumpMap: bumpTex,
      bumpScale: 0.04,
    });
    const mossStoneMat = new THREE.MeshStandardMaterial({
      color: 0x456358,
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true,
    });

    const altarGroup = new THREE.Group();
    const step1 = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.6, 0.24, 8), mossStoneMat);
    step1.position.y = 0.12;
    step1.receiveShadow = true;
    altarGroup.add(step1);

    const step2 = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 0.28, 8), stoneMat);
    step2.position.y = 0.36;
    step2.receiveShadow = true;
    step2.castShadow = true;
    altarGroup.add(step2);

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.32, 0.42, 8), stoneMat);
    pedestal.position.y = 0.68;
    pedestal.receiveShadow = true;
    pedestal.castShadow = true;
    altarGroup.add(pedestal);

    // Glowing Triforce inlay ring on top of pedestal (offset +0.02 to prevent Z-fighting)
    const runeRingMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x22d3ee,
      emissiveIntensity: 1.4,
      roughness: 0.25,
      metalness: 0.4,
    });
    this.auraRingMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 0.88, 8),
      runeRingMat,
    );
    this.auraRingMesh.rotation.x = -Math.PI / 2;
    this.auraRingMesh.position.y = 0.91;
    altarGroup.add(this.auraRingMesh);

    // Soft radial contact shadow beneath hovering Ocarina
    const contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.95, 24),
      new THREE.MeshBasicMaterial({
        map: createContactShadowTexture(),
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
      }),
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.905;
    altarGroup.add(contactShadow);

    this.scene.add(altarGroup);

    // 3. Six Ancient Temple Pillars circling the altar
    const pillarBaseGeo = new THREE.CylinderGeometry(0.38, 0.46, 0.45, 6);
    const pillarShaftGeo = new THREE.CylinderGeometry(0.28, 0.35, 2.6, 6);
    const pillarCapGeo = new THREE.CylinderGeometry(0.44, 0.32, 0.3, 6);
    const runeBandGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.16, 6);

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + 0.32;
      const px = Math.cos(angle) * 6.0;
      const pz = Math.sin(angle) * 6.0;
      // Leave space clear around scoreboard monolith at (+4.2, -2.6)
      if (Math.hypot(px - 4.2, pz + 2.6) < 2.2) continue;

      const pGroup = new THREE.Group();
      const base = new THREE.Mesh(pillarBaseGeo, mossStoneMat);
      base.position.y = 0.225;
      base.castShadow = true;
      base.receiveShadow = true;

      const shaft = new THREE.Mesh(pillarShaftGeo, stoneMat);
      shaft.position.y = 1.7;
      shaft.castShadow = true;
      shaft.receiveShadow = true;

      const cap = new THREE.Mesh(pillarCapGeo, stoneMat);
      cap.position.y = 3.12;
      cap.castShadow = true;

      const rune = new THREE.Mesh(
        runeBandGeo,
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0ea5e9,
          emissiveIntensity: 0.9,
          roughness: 0.3,
        }),
      );
      rune.position.y = 2.45;
      this.pillarRunes.push(rune);

      pGroup.add(base, shaft, cap, rune);
      pGroup.position.set(px, groundHeightAt(px, pz), pz);
      pGroup.rotation.y = angle;
      this.scene.add(pGroup);
    }

    // 4. Instanced Low-Poly Pine Grove around perimeter (44 trees)
    const treeCount = 44;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.4, 5);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x4b3621,
      roughness: 0.92,
      flatShading: true,
    });
    const foliageGeo = new THREE.ConeGeometry(1.15, 2.5, 6);
    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      flatShading: true,
    });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const foliageLower = new THREE.InstancedMesh(foliageGeo, foliageMat, treeCount);
    const foliageUpper = new THREE.InstancedMesh(foliageGeo, foliageMat, treeCount);
    trunks.castShadow = true;
    foliageLower.castShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < treeCount; i++) {
      const a = (i / treeCount) * Math.PI * 2 + (i % 3) * 0.14;
      const dist = 10.5 + (i % 5) * 2.8 + Math.sin(i * 7.1) * 1.1;
      const tx = Math.cos(a) * dist;
      const tz = Math.sin(a) * dist;
      const ty = groundHeightAt(tx, tz);
      const sc = 0.85 + (i % 4) * 0.15;

      dummy.position.set(tx, ty + 0.7 * sc, tz);
      dummy.rotation.set(0, a, 0);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);

      dummy.position.set(tx, ty + 2.0 * sc, tz);
      dummy.scale.set(sc * 1.1, sc, sc * 1.1);
      dummy.updateMatrix();
      foliageLower.setMatrixAt(i, dummy.matrix);

      dummy.position.set(tx, ty + 3.1 * sc, tz);
      dummy.scale.set(sc * 0.78, sc * 0.82, sc * 0.78);
      dummy.updateMatrix();
      foliageUpper.setMatrixAt(i, dummy.matrix);

      const shade = 0.75 + (i % 5) * 0.08;
      _color.setRGB(0.11 * shade, 0.38 * shade, 0.26 * shade);
      foliageLower.setColorAt(i, _color);
      _color.setRGB(0.15 * shade, 0.46 * shade, 0.30 * shade);
      foliageUpper.setColorAt(i, _color);
    }
    trunks.computeBoundingSphere();
    foliageLower.computeBoundingSphere();
    foliageUpper.computeBoundingSphere();
    this.scene.add(trunks, foliageLower, foliageUpper);

    // 5. Instanced Faceted Mossy Boulders (28 rocks)
    const rockCount = 28;
    const rockGeo = new THREE.DodecahedronGeometry(0.55, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      flatShading: true,
    });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    for (let i = 0; i < rockCount; i++) {
      const a = (i / rockCount) * Math.PI * 2 + 0.5;
      const dist = 7.4 + (i % 4) * 2.2;
      const rx = Math.cos(a) * dist;
      const rz = Math.sin(a) * dist;
      const ry = groundHeightAt(rx, rz);
      const sc = 0.65 + (i % 4) * 0.25;
      dummy.position.set(rx, ry + sc * 0.22, rz);
      dummy.rotation.set(i * 0.7, i * 1.3, 0);
      dummy.scale.set(sc * 1.2, sc * 0.72, sc);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);

      _color.setHex(i % 2 === 0 ? 0x4b5c66 : 0x3f544a);
      rocks.setColorAt(i, _color);
    }
    rocks.computeBoundingSphere();
    this.scene.add(rocks);
  }

  private buildOcarinaHero(): void {
    this.ocarinaRoot = new THREE.Group();
    this.ocarinaRoot.position.set(0, 1.56, 0);

    this.ocarinaBodyGroup = new THREE.Group();
    // Tilt slightly toward camera so all 5 top holes are clearly clickable & legible
    this.ocarinaBodyGroup.rotation.x = 0.42;
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

    // 3. Metallic Gold Collar Band around mouthpiece neck (proud & visible)
    const collarGeo = new THREE.CylinderGeometry(0.175, 0.195, 0.14, 8);
    collarGeo.rotateZ(Math.PI / 2);
    collarGeo.scale(1, 0.85, 1.15);
    const collarMesh = new THREE.Mesh(collarGeo, goldBandMat);
    collarMesh.position.set(-0.84, 0.0, 0.48);
    collarMesh.rotation.y = 0.58;
    collarMesh.castShadow = true;
    this.ocarinaBodyGroup.add(collarMesh);

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

    // 5. Acoustic sound-hole slot underneath
    const slotMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.06, 0.14),
      darkCavityMat,
    );
    slotMesh.position.set(-0.35, -0.34, 0.1);
    this.ocarinaBodyGroup.add(slotMesh);

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
    this.fairyGroup.position.set(-1.35, 2.2, 0.45);

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.11, 0),
      new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.8,
        roughness: 0.1,
        flatShading: true,
      }),
    );
    this.fairyGroup.add(core);

    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(0.24, 0.14);
    wingShape.lineTo(0.30, 0.02);
    wingShape.lineTo(0.16, -0.06);
    wingShape.closePath();

    const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
      depth: 0.01,
      bevelEnabled: false,
    });
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.28,
      transparent: true,
      opacity: 0.72,
      roughness: 0.25,
      side: THREE.DoubleSide,
    });

    const configs = [
      { x: 0.04, y: 0.04, ry: -0.35, rz: 0.2, sx: 1 },
      { x: -0.04, y: 0.04, ry: 0.35, rz: -0.2, sx: -1 },
      { x: 0.04, y: -0.03, ry: -0.4, rz: -0.25, sx: 0.78 },
      { x: -0.04, y: -0.03, ry: 0.4, rz: 0.25, sx: -0.78 },
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
    const mx = 4.2;
    const mz = -2.6;
    monoGroup.position.set(mx, groundHeightAt(mx, mz), mz);
    monoGroup.rotation.y = -0.52;

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
          this.activePointerHole = noteId;
          dom.setPointerCapture?.(e.pointerId);
          this.callbacks.onHolePress(noteId);
          return;
        }
      }
      this.isDraggingTilt = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      dom.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      updateNdc(e);
      if (this.isDraggingTilt) {
        const dx = (e.clientX - this.dragStart.x) / 140;
        const dy = (e.clientY - this.dragStart.y) / 140;
        this.setPointerTilt(dx, dy);
        this.callbacks.onDragTilt(dx, dy);
        return;
      }
      if (!this.activePointerHole && this.cameraMode === 'title') {
        this.setPointerTilt(this.pointerNdc.x * 0.45, this.pointerNdc.y * 0.35);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (this.activePointerHole) {
        const noteId = this.activePointerHole;
        this.activePointerHole = null;
        this.callbacks.onHoleRelease(noteId);
      }
      if (this.isDraggingTilt) {
        this.isDraggingTilt = false;
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

    // Apply spring physics to Ocarina root & body
    const hoverY = 1.54 + Math.sin(this.elapsed * 1.9) * 0.055 + this.physics.bounceY.value;
    this.ocarinaRoot.position.y = hoverY;
    this.ocarinaBodyGroup.rotation.x = 0.42 + this.physics.tiltX.value;
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

    // Animate Fairy Companion orbit & wing flap
    const wingSpeed = 16 + Math.min(20, this.comboLevel * 0.8);
    const orbitR = 1.35;
    this.fairyGroup.position.x = Math.cos(this.elapsed * 1.15) * orbitR;
    this.fairyGroup.position.z = Math.sin(this.elapsed * 1.15) * 0.85 + 0.15;
    this.fairyGroup.position.y = 2.08 + Math.sin(this.elapsed * 2.8) * 0.18;
    for (const wing of this.fairyWings) {
      const flap = Math.sin(this.elapsed * wingSpeed) * 0.55;
      wing.rotation.y = (wing.userData.baseRy as number) + flap * (wing.userData.side as number);
    }

    // Animate Rupee trophies
    for (let i = 0; i < this.rupeeMeshes.length; i++) {
      const r = this.rupeeMeshes[i];
      r.rotation.y = this.elapsed * 1.6 + i * 1.1;
      r.position.y = (r.userData.baseY as number) + Math.sin(this.elapsed * 2.4 + i) * 0.05;
    }

    // Aura & Pillar Runes decay
    this.auraBoost = Math.max(0, this.auraBoost - dt * 0.75);
    this.auraLight.color.copy(this.auraColor);
    this.auraLight.intensity = 1.3 + this.auraBoost * 3.2 + this.physics.breathPressure * 0.8;
    const auraMat = this.auraRingMesh.material as THREE.MeshStandardMaterial;
    auraMat.emissive.copy(this.auraColor);
    auraMat.emissiveIntensity = 1.1 + this.auraBoost * 2.4;
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

    // Exponentially damped camera framing (with portrait-aspect pull-back)
    const portraitScale =
      this.camera.aspect < 1
        ? Math.min(1.85, 1.02 / Math.max(0.55, this.camera.aspect))
        : 1;

    if (this.cameraMode === 'title') {
      const panX = Math.sin(this.elapsed * 0.28) * 0.95;
      _vec3.set(panX + 0.55, 2.35, 4.95 * portraitScale);
      _vec3B.set(-0.35, 1.38, 0);
    } else if (this.cameraMode === 'scoreboard') {
      _vec3.set(2.55, 2.35, 2.35 * portraitScale);
      _vec3B.set(4.15, 1.68, -2.5);
    } else {
      _vec3.set(0, 2.65, 3.05 * portraitScale);
      _vec3B.set(0, 1.18, 0.08);
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
