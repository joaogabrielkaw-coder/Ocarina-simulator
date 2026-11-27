import * as THREE from 'three';

export interface MusicianRig {
  root: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  armsGroup: THREE.Group;
  ocarinaProp: THREE.Group;
  leftFoot: THREE.Mesh;
  rightFoot: THREE.Mesh;
}

export interface CatRig {
  root: THREE.Group;
  headGroup: THREE.Group;
  tailBase: THREE.Group;
  tailTip: THREE.Group;
  leftEar: THREE.Group;
  rightEar: THREE.Group;
}

export interface VillagePropsRig {
  root: THREE.Group;
  bobber: THREE.Mesh;
  rodTipGroup: THREE.Group;
}

function makeMat(
  color: number,
  roughness = 0.78,
  metalness = 0.04,
  flatShading = false,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    flatShading,
  });
}

function createLimbBetween(
  a: THREE.Vector3,
  b: THREE.Vector3,
  rStart: number,
  rEnd: number,
  radialSegments: number,
  material: THREE.Material,
): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(0.001, dir.length());
  const geo = new THREE.CylinderGeometry(rEnd, rStart, len, radialSegments, 1);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createCurvedTube(
  points: THREE.Vector3[],
  radius: number,
  tubularSegments: number,
  radialSegments: number,
  material: THREE.Material,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

/**
 * Builds a tapered sculpted hair lock curving along a 3D path using Lathe + bend/scale.
 */
function createHairLock(
  length: number,
  maxRadius: number,
  flattenZ: number,
  material: THREE.Material,
): THREE.Mesh {
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0.002, 0),
    new THREE.Vector2(maxRadius * 0.42, length * 0.14),
    new THREE.Vector2(maxRadius * 0.92, length * 0.45),
    new THREE.Vector2(maxRadius, length * 0.76),
    new THREE.Vector2(maxRadius * 0.62, length * 0.94),
    new THREE.Vector2(0.002, length),
  ];
  const geo = new THREE.LatheGeometry(profile, 8);
  geo.scale(1.0, 1.0, flattenZ);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

/**
 * Builds a rounded-rectangle glasses rim with a hollowed inner lens cutout.
 */
function createRoundedRimGeometry(
  outerW: number,
  outerH: number,
  rimThickness: number,
  cornerRadius: number,
): THREE.ExtrudeGeometry {
  const hw = outerW / 2;
  const hh = outerH / 2;
  const r = Math.min(cornerRadius, hw * 0.45, hh * 0.45);

  const outer = new THREE.Shape();
  outer.moveTo(-hw + r, -hh);
  outer.lineTo(hw - r, -hh);
  outer.quadraticCurveTo(hw, -hh, hw, -hh + r);
  outer.lineTo(hw, hh - r);
  outer.quadraticCurveTo(hw, hh, hw - r, hh);
  outer.lineTo(-hw + r, hh);
  outer.quadraticCurveTo(-hw, hh, -hw, hh - r);
  outer.lineTo(-hw, -hh + r);
  outer.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  const ihw = hw - rimThickness;
  const ihh = hh - rimThickness;
  const ir = Math.max(0.004, r - rimThickness * 0.5);
  const cleanHole = new THREE.Path();
  cleanHole.moveTo(-ihw + ir, -ihh);
  cleanHole.quadraticCurveTo(-ihw, -ihh, -ihw, -ihh + ir);
  cleanHole.lineTo(-ihw, ihh - ir);
  cleanHole.quadraticCurveTo(-ihw, ihh, -ihw + ir, ihh);
  cleanHole.lineTo(ihw - ir, ihh);
  cleanHole.quadraticCurveTo(ihw, ihh, ihw, ihh - ir);
  cleanHole.lineTo(ihw, -ihh + ir);
  cleanHole.quadraticCurveTo(ihw, -ihh, ihw - ir, -ihh);
  cleanHole.lineTo(-ihw + ir, -ihh);
  outer.holes.push(cleanHole);

  return new THREE.ExtrudeGeometry(outer, {
    depth: 0.015,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.003,
    bevelSegments: 2,
    curveSegments: 8,
  });
}

function createRoundedFootShape(width: number, length: number): THREE.Shape {
  const hw = width / 2;
  const hl = length / 2;
  const s = new THREE.Shape();
  s.moveTo(0, -hl);
  s.bezierCurveTo(hw * 0.95, -hl, hw, -hl * 0.35, hw * 0.96, 0.02);
  s.bezierCurveTo(hw * 1.05, hl * 0.48, hw * 0.85, hl, 0, hl);
  s.bezierCurveTo(-hw * 0.85, hl, -hw * 1.05, hl * 0.48, -hw * 0.96, 0.02);
  s.bezierCurveTo(-hw, -hl * 0.35, -hw * 0.95, -hl, 0, -hl);
  return s;
}

/**
 * Builds the sculpted retro Nintendo-inspired chibi musician:
 * rounded Lathe/Sphere forms (non-boxy), layered swept hair locks, beveled glasses with hinge pins & catchlight eyes,
 * tailored V-lapel tunic with Triforce gold brooch & leather belt, articulated fingers cradling the 3D Ocarina,
 * and tapered legs with laced crimson sneakers dangling over the moonlit water edge.
 */
export function createMusicianCharacter(withMiniOcarina = false): MusicianRig {
  const root = new THREE.Group();

  const skinMat = makeMat(0xf0c292, 0.72, 0.02);
  const innerEarSkinMat = makeMat(0xdca072, 0.78, 0.01);
  const blushMat = makeMat(0xe58d78, 0.78, 0.0);
  const darkHairMat = makeMat(0x23140e, 0.84, 0.03);
  const hairSheenMat = makeMat(0x331d15, 0.78, 0.04);
  const tunicMat = makeMat(0x181a24, 0.84, 0.05);
  const collarMat = makeMat(0x2c344a, 0.76, 0.08);
  const innerShirtMat = makeMat(0xe2e6ef, 0.88, 0.01);
  const beltMat = makeMat(0x462816, 0.60, 0.06);
  const goldMat = makeMat(0xf4c44e, 0.20, 0.90);
  const silverMat = makeMat(0xdbe2ec, 0.24, 0.88);
  const bootMat = makeMat(0x96221a, 0.44, 0.08);
  const toeCapMat = makeMat(0xf1eadb, 0.68, 0.02);
  const soleMat = makeMat(0x26100d, 0.90, 0.03);
  const laceMat = makeMat(0xf8f3e8, 0.76, 0.01);
  const glassFrameMat = makeMat(0x10141e, 0.22, 0.52);
  const glassLensMat = new THREE.MeshStandardMaterial({
    color: 0x243856,
    roughness: 0.08,
    metalness: 0.16,
    transparent: true,
    opacity: 0.22,
  });
  const eyeMat = makeMat(0x130d0b, 0.26, 0.08);
  const eyeCatchMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mouthMat = makeMat(0x8e5240, 0.76, 0.0);
  const ocarinaBlueMat = makeMat(0x1b4de0, 0.24, 0.10);

  // 1. Sculpted seated hips resting flush on the stone ledge (y=0)
  const hipsGeo = new THREE.SphereGeometry(0.24, 16, 12);
  hipsGeo.scale(1.06, 0.44, 0.82);
  const hips = new THREE.Mesh(hipsGeo, tunicMat);
  hips.position.set(0, 0.085, -0.02);
  hips.castShadow = true;
  hips.receiveShadow = true;
  root.add(hips);

  // 2. Sculpted tapered legs & detailed laced crimson sneakers dangling over water
  const shoeUpperShape = createRoundedFootShape(0.185, 0.275);
  const shoeUpperGeo = new THREE.ExtrudeGeometry(shoeUpperShape, {
    depth: 0.09,
    bevelEnabled: true,
    bevelThickness: 0.026,
    bevelSize: 0.02,
    bevelSegments: 3,
    curveSegments: 10,
  });
  shoeUpperGeo.rotateX(Math.PI / 2);
  shoeUpperGeo.translate(0, 0.055, 0);

  const soleShape = createRoundedFootShape(0.202, 0.292);
  const soleGeo = new THREE.ExtrudeGeometry(soleShape, {
    depth: 0.032,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 10,
  });
  soleGeo.rotateX(Math.PI / 2);

  const buildLeg = (side: -1 | 1): THREE.Mesh => {
    const legGroup = new THREE.Group();
    const hipPt = new THREE.Vector3(side * 0.135, 0.09, 0.02);
    const kneePt = new THREE.Vector3(side * 0.145, 0.075, 0.295);
    const anklePt = new THREE.Vector3(side * 0.145, -0.25, 0.34);

    // Tapered thigh & calf + knee sphere joint
    legGroup.add(createLimbBetween(hipPt, kneePt, 0.095, 0.08, 12, skinMat));

    const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.082, 12, 10), skinMat);
    kneeCap.position.copy(kneePt);
    kneeCap.castShadow = true;
    legGroup.add(kneeCap);

    legGroup.add(createLimbBetween(kneePt, anklePt, 0.08, 0.064, 12, skinMat));

    // Folded cream ankle sock cuff
    const sockCuff = new THREE.Mesh(
      new THREE.TorusGeometry(0.066, 0.02, 8, 14),
      innerShirtMat,
    );
    sockCuff.rotation.x = Math.PI / 2;
    sockCuff.position.set(anklePt.x, anklePt.y + 0.01, anklePt.z);
    legGroup.add(sockCuff);

    // Detailed Laced Boot (returned as foot mesh so animation rotates cleanly at ankle)
    const boot = new THREE.Mesh(shoeUpperGeo, bootMat);
    boot.position.set(side * 0.145, -0.325, 0.38);
    boot.castShadow = true;
    boot.receiveShadow = true;

    const sole = new THREE.Mesh(soleGeo, soleMat);
    sole.position.set(0, -0.05, 0);
    sole.castShadow = true;
    boot.add(sole);

    // Rounded rubber toe cap
    const toeCapGeo = new THREE.SphereGeometry(0.094, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
    toeCapGeo.scale(1.0, 0.72, 1.05);
    const toeCap = new THREE.Mesh(toeCapGeo, toeCapMat);
    toeCap.position.set(0, -0.02, 0.088);
    toeCap.rotation.x = 0.25;
    boot.add(toeCap);

    // Sneaker ankle collar & tongue
    const bootCollar = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.022, 8, 14), bootMat);
    bootCollar.rotation.x = Math.PI / 2;
    bootCollar.position.set(0, 0.082, -0.045);
    boot.add(bootCollar);

    const tongueGeo = new THREE.CapsuleGeometry(0.042, 0.05, 4, 8);
    tongueGeo.scale(1.15, 1.0, 0.45);
    const tongue = new THREE.Mesh(tongueGeo, bootMat);
    tongue.position.set(0, 0.078, 0.02);
    tongue.rotation.x = -0.38;
    boot.add(tongue);

    // 3 sculpted shoelace bars + metallic brass eyelets
    const laceGeo = new THREE.CapsuleGeometry(0.0085, 0.075, 4, 6);
    laceGeo.rotateZ(Math.PI / 2);
    const eyeletGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.014, 8);
    for (let i = 0; i < 3; i++) {
      const lz = 0.01 + i * 0.032;
      const ly = 0.086 - i * 0.015;
      const lace = new THREE.Mesh(laceGeo, laceMat);
      lace.position.set(0, ly, lz);
      lace.rotation.y = i % 2 === 0 ? 0.14 : -0.14;
      boot.add(lace);

      for (const ex of [-0.044, 0.044]) {
        const eyelet = new THREE.Mesh(eyeletGeo, goldMat);
        eyelet.position.set(ex, ly - 0.003, lz);
        boot.add(eyelet);
      }
    }

    legGroup.add(boot);
    root.add(legGroup);
    return boot;
  };

  const leftFoot = buildLeg(-1);
  const rightFoot = buildLeg(1);

  // 3. Sculpted Upper Torso (Lathe silhouette + jacket lapels + shirt V-insert + Triforce brooch + belt)
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.14, -0.02);
  root.add(torsoGroup);

  const torsoProfile: THREE.Vector2[] = [
    new THREE.Vector2(0.01, -0.03),
    new THREE.Vector2(0.24, -0.02),
    new THREE.Vector2(0.225, 0.08), // waist
    new THREE.Vector2(0.245, 0.24), // ribcage
    new THREE.Vector2(0.252, 0.39), // chest / shoulders
    new THREE.Vector2(0.185, 0.475), // shoulder slope
    new THREE.Vector2(0.095, 0.495), // neck base
    new THREE.Vector2(0.01, 0.50),
  ];
  const torsoGeo = new THREE.LatheGeometry(torsoProfile, 16);
  torsoGeo.scale(1.06, 1.0, 0.74);
  torsoGeo.computeVertexNormals();
  const torsoMesh = new THREE.Mesh(torsoGeo, tunicMat);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torsoGroup.add(torsoMesh);

  // Inner cream undershirt V-insert at front chest
  const vShirtShape = new THREE.Shape();
  vShirtShape.moveTo(0, -0.13);
  vShirtShape.lineTo(0.095, 0.03);
  vShirtShape.lineTo(-0.095, 0.03);
  vShirtShape.closePath();
  const vShirtGeo = new THREE.ExtrudeGeometry(vShirtShape, {
    depth: 0.035,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.006,
    bevelSegments: 2,
  });
  const vShirt = new THREE.Mesh(vShirtGeo, innerShirtMat);
  vShirt.position.set(0, 0.445, 0.145);
  vShirt.rotation.x = -0.12;
  torsoGroup.add(vShirt);

  // Sculpted Collar Wrap + Tailored Jacket Lapels
  const backCollar = new THREE.Mesh(
    new THREE.TorusGeometry(0.135, 0.034, 8, 16, Math.PI * 1.35),
    collarMat,
  );
  backCollar.rotation.x = Math.PI / 2 + 0.16;
  backCollar.rotation.z = -Math.PI * 0.175;
  backCollar.position.set(0, 0.475, -0.01);
  torsoGroup.add(backCollar);

  const lapelShape = new THREE.Shape();
  lapelShape.moveTo(0, 0);
  lapelShape.lineTo(0.078, 0.14);
  lapelShape.lineTo(0.025, 0.16);
  lapelShape.lineTo(-0.012, 0.01);
  lapelShape.closePath();
  const lapelGeo = new THREE.ExtrudeGeometry(lapelShape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.005,
    bevelSegments: 2,
  });

  for (const side of [-1, 1] as const) {
    const lapel = new THREE.Mesh(lapelGeo, collarMat);
    lapel.position.set(side * 0.015, 0.315, 0.172);
    lapel.scale.x = side;
    lapel.rotation.x = -0.14;
    lapel.rotation.y = side * 0.2;
    torsoGroup.add(lapel);
  }

  // Gold Triforce lapel badge on left chest
  const pinTriShape = new THREE.Shape();
  pinTriShape.moveTo(0, 0.018);
  pinTriShape.lineTo(-0.016, -0.01);
  pinTriShape.lineTo(0.016, -0.01);
  pinTriShape.closePath();
  const pinTriGeo = new THREE.ExtrudeGeometry(pinTriShape, { depth: 0.008, bevelEnabled: false });
  const pinGroup = new THREE.Group();
  const pt1 = new THREE.Mesh(pinTriGeo, goldMat);
  pt1.position.set(0, 0.015, 0);
  const pt2 = new THREE.Mesh(pinTriGeo, goldMat);
  pt2.position.set(-0.017, -0.013, 0);
  const pt3 = new THREE.Mesh(pinTriGeo, goldMat);
  pt3.position.set(0.017, -0.013, 0);
  pinGroup.add(pt1, pt2, pt3);
  pinGroup.position.set(0.115, 0.375, 0.184);
  pinGroup.rotation.y = 0.28;
  torsoGroup.add(pinGroup);

  // Leather Waist Belt & Brass Buckle
  const beltGeo = new THREE.TorusGeometry(0.228, 0.024, 8, 20);
  beltGeo.rotateX(Math.PI / 2);
  beltGeo.scale(1.06, 1.0, 0.78);
  const belt = new THREE.Mesh(beltGeo, beltMat);
  belt.position.set(0, 0.085, 0);
  torsoGroup.add(belt);

  const buckleFrame = new THREE.Mesh(
    createRoundedRimGeometry(0.082, 0.064, 0.014, 0.012),
    goldMat,
  );
  buckleFrame.position.set(0, 0.085, 0.182);
  torsoGroup.add(buckleFrame);

  // 4. Sculpted Arms, Rolled Cuffs & Articulated Hands Cradling the 3D Ocarina
  const armsGroup = new THREE.Group();
  armsGroup.position.set(0, 0.40, 0.06);
  torsoGroup.add(armsGroup);

  for (const side of [-1, 1] as const) {
    const shPt = new THREE.Vector3(side * 0.252, 0.02, -0.025);
    const elPt = new THREE.Vector3(side * 0.305, -0.135, 0.125);
    const wrPt = new THREE.Vector3(side * 0.175, -0.052, 0.285);
    const palmCenter = new THREE.Vector3(side * 0.145, -0.038, 0.318);

    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.078, 12, 10), tunicMat);
    shoulderCap.position.copy(shPt);
    shoulderCap.castShadow = true;
    armsGroup.add(shoulderCap);

    armsGroup.add(createLimbBetween(shPt, elPt, 0.074, 0.063, 10, tunicMat));

    const elbowCap = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), tunicMat);
    elbowCap.position.copy(elPt);
    elbowCap.castShadow = true;
    armsGroup.add(elbowCap);

    armsGroup.add(createLimbBetween(elPt, wrPt, 0.066, 0.055, 10, tunicMat));

    // Jacket sleeve cuff + subtle cream inner shirt cuff
    const armDir = new THREE.Vector3().subVectors(wrPt, elPt).normalize();
    const cuffQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), armDir);

    const sleeveCuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062, 0.062, 0.036, 12),
      collarMat,
    );
    sleeveCuff.position.copy(wrPt).addScaledVector(armDir, -0.015);
    sleeveCuff.quaternion.copy(cuffQuat);
    armsGroup.add(sleeveCuff);

    const shirtCuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.052, 0.024, 12),
      innerShirtMat,
    );
    shirtCuff.position.copy(wrPt).addScaledVector(armDir, 0.008);
    shirtCuff.quaternion.copy(cuffQuat);
    armsGroup.add(shirtCuff);

    const cuffButton = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 6), silverMat);
    cuffButton.position.copy(wrPt).add(new THREE.Vector3(side * 0.048, -0.02, -0.015));
    armsGroup.add(cuffButton);

    // Sculpted palm + thumb + curved fingers wrapping toward Ocarina
    const palmGeo = new THREE.SphereGeometry(0.06, 12, 10);
    palmGeo.scale(0.82, 0.92, 1.15);
    const palm = new THREE.Mesh(palmGeo, skinMat);
    palm.position.copy(palmCenter);
    palm.rotation.y = -side * 0.45;
    palm.castShadow = true;
    armsGroup.add(palm);

    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.019, 0.042, 4, 8), skinMat);
    thumb.position.set(palmCenter.x - side * 0.024, palmCenter.y + 0.038, palmCenter.z - 0.01);
    thumb.rotation.set(0.42, 0, side * 0.52);
    thumb.castShadow = true;
    armsGroup.add(thumb);

    for (let f = 0; f < 3; f++) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.038, 4, 8), skinMat);
      finger.position.set(
        palmCenter.x - side * 0.036,
        palmCenter.y + (1 - f) * 0.022,
        palmCenter.z + 0.026 - f * 0.008,
      );
      finger.rotation.set(0.18, -side * 0.6, side * 1.15);
      finger.castShadow = true;
      armsGroup.add(finger);
    }
  }

  // Optional mini Ocarina prop (kept for compatibility when Hero Ocarina sits in hands)
  const ocarinaProp = new THREE.Group();
  ocarinaProp.position.set(0, -0.06, 0.37);
  ocarinaProp.rotation.set(0.12, -0.18, 0.05);
  ocarinaProp.visible = withMiniOcarina;

  const miniBodyGeo = new THREE.SphereGeometry(0.13, 12, 8);
  miniBodyGeo.scale(1.6, 0.68, 0.95);
  const miniBody = new THREE.Mesh(miniBodyGeo, ocarinaBlueMat);
  miniBody.castShadow = true;
  ocarinaProp.add(miniBody);

  const miniMouth = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.08, 4, 8), ocarinaBlueMat);
  miniMouth.rotation.z = Math.PI / 2;
  miniMouth.rotation.y = 0.5;
  miniMouth.position.set(-0.16, 0.01, 0.07);
  ocarinaProp.add(miniMouth);

  const miniCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.045, 10), goldMat);
  miniCollar.rotation.z = Math.PI / 2;
  miniCollar.rotation.y = 0.5;
  miniCollar.position.set(-0.14, 0.01, 0.06);
  ocarinaProp.add(miniCollar);

  armsGroup.add(ocarinaProp);

  // 5. Sculpted Chibi Head + Expressive Face + Beveled Glasses + Voluminous Swept Hair
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.50, 0.02);
  torsoGroup.add(headGroup);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.106, 0.12, 12), skinMat);
  neck.position.set(0, 0.03, 0);
  headGroup.add(neck);

  // Soft sculpted chibi cranium (chubby cheeks, tapered jaw/chin, rounded brow & crown)
  const headProfile: THREE.Vector2[] = [
    new THREE.Vector2(0.002, 0.065), // rounded chin
    new THREE.Vector2(0.155, 0.095), // jawline
    new THREE.Vector2(0.255, 0.165), // lower cheeks
    new THREE.Vector2(0.288, 0.255), // full cheeks
    new THREE.Vector2(0.282, 0.365), // temples / brow
    new THREE.Vector2(0.254, 0.465), // forehead
    new THREE.Vector2(0.185, 0.545), // upper dome
    new THREE.Vector2(0.002, 0.585), // crown apex
  ];
  const craniumGeo = new THREE.LatheGeometry(headProfile, 18);
  craniumGeo.scale(1.06, 1.0, 0.94);
  craniumGeo.computeVertexNormals();
  const cranium = new THREE.Mesh(craniumGeo, skinMat);
  cranium.castShadow = true;
  cranium.receiveShadow = true;
  headGroup.add(cranium);

  // Sculpted rounded ears with inner helix recess
  const earOuterGeo = new THREE.SphereGeometry(0.068, 12, 10);
  earOuterGeo.scale(0.52, 1.05, 0.78);
  const earInnerGeo = new THREE.SphereGeometry(0.038, 10, 8);
  earInnerGeo.scale(0.45, 0.85, 0.65);

  for (const side of [-1, 1] as const) {
    const earOuter = new THREE.Mesh(earOuterGeo, skinMat);
    earOuter.position.set(side * 0.295, 0.275, -0.015);
    earOuter.rotation.z = -side * 0.14;
    earOuter.castShadow = true;

    const earInner = new THREE.Mesh(earInnerGeo, innerEarSkinMat);
    earInner.position.set(side * 0.302, 0.275, 0.005);
    earInner.rotation.z = -side * 0.14;
    headGroup.add(earOuter, earInner);
  }

  // Expressive Eyes with Sclera Rim & White Specular Catchlights, Brows, Cheek Blush, Nose & Gentle Smile
  const scleraMat = makeMat(0xf4f7fb, 0.35, 0.02);
  const scleraGeo = new THREE.SphereGeometry(0.049, 12, 10);
  scleraGeo.scale(1.18, 0.68, 0.28);
  const eyeGeo = new THREE.SphereGeometry(0.036, 12, 10);
  eyeGeo.scale(1.04, 0.72, 0.34);
  const catchGeo = new THREE.SphereGeometry(0.011, 8, 6);
  const blushGeo = new THREE.SphereGeometry(0.044, 10, 8);
  blushGeo.scale(1.3, 0.62, 0.28);

  for (const side of [-1, 1] as const) {
    const sclera = new THREE.Mesh(scleraGeo, scleraMat);
    sclera.position.set(side * 0.118, 0.295, 0.252);
    sclera.rotation.y = side * 0.16;

    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * 0.118, 0.295, 0.257);
    eye.rotation.y = side * 0.16;

    const catchDot = new THREE.Mesh(catchGeo, eyeCatchMat);
    catchDot.position.set(side * 0.118 - 0.012, 0.304, 0.268);

    const brow = createCurvedTube(
      [
        new THREE.Vector3(side * 0.068, 0.358, 0.256),
        new THREE.Vector3(side * 0.118, 0.372, 0.260),
        new THREE.Vector3(side * 0.172, 0.360, 0.242),
      ],
      0.010,
      8,
      6,
      darkHairMat,
    );

    const blush = new THREE.Mesh(blushGeo, blushMat);
    blush.position.set(side * 0.172, 0.215, 0.238);
    blush.rotation.y = side * 0.34;

    headGroup.add(eye, catchDot, brow, blush);
  }

  // Sculpted button nose
  const noseGeo = new THREE.SphereGeometry(0.027, 10, 8);
  noseGeo.scale(0.92, 0.82, 1.18);
  const nose = new THREE.Mesh(noseGeo, skinMat);
  nose.position.set(0, 0.238, 0.278);
  headGroup.add(nose);

  // Subtle sculpted smile
  const mouth = createCurvedTube(
    [
      new THREE.Vector3(-0.046, 0.166, 0.254),
      new THREE.Vector3(0, 0.156, 0.265),
      new THREE.Vector3(0.046, 0.166, 0.254),
    ],
    0.0085,
    10,
    6,
    mouthMat,
  );
  headGroup.add(mouth);

  // Detailed Beveled Rounded-Rectangle Glasses with Bridge, Nose Pads & Curved Temple Arms
  const glassesGroup = new THREE.Group();
  glassesGroup.position.set(0, 0.295, 0.278);

  const rimGeo = createRoundedRimGeometry(0.178, 0.106, 0.013, 0.022);
  const lensGeo = new THREE.PlaneGeometry(0.156, 0.084);

  for (const side of [-1, 1] as const) {
    const cx = side * 0.122;
    const rim = new THREE.Mesh(rimGeo, glassFrameMat);
    rim.position.set(cx, 0, 0);
    rim.rotation.y = side * 0.08;

    const lens = new THREE.Mesh(lensGeo, glassLensMat);
    lens.position.set(cx, 0, 0.006);
    lens.rotation.y = side * 0.08;

    // Metallic hinge rivet on outer rim corner
    const hinge = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), silverMat);
    hinge.position.set(cx + side * 0.09, 0.028, 0.009);

    // Clear nose pad cushion
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6), innerShirtMat);
    pad.position.set(cx - side * 0.072, -0.012, -0.014);

    // Curved temple arm hooking smoothly around top of ear
    const temple = createCurvedTube(
      [
        new THREE.Vector3(cx + side * 0.088, 0.024, 0.004),
        new THREE.Vector3(side * 0.278, 0.028, -0.10),
        new THREE.Vector3(side * 0.296, 0.018, -0.26),
        new THREE.Vector3(side * 0.288, -0.025, -0.32),
      ],
      0.009,
      10,
      6,
      glassFrameMat,
    );

    glassesGroup.add(rim, lens, hinge, pad, temple);
  }

  const bridge = createCurvedTube(
    [
      new THREE.Vector3(-0.036, 0.018, 0.008),
      new THREE.Vector3(0, 0.026, 0.014),
      new THREE.Vector3(0.036, 0.018, 0.008),
    ],
    0.009,
    8,
    6,
    glassFrameMat,
  );
  glassesGroup.add(bridge);
  headGroup.add(glassesGroup);

  // Voluminous Layered Sculpted Hair (smooth organic dome + sculpted curved curtain locks!)
  const hairCapGeo = new THREE.SphereGeometry(0.328, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.65);
  hairCapGeo.scale(1.08, 1.04, 1.02);
  const hairCap = new THREE.Mesh(hairCapGeo, darkHairMat);
  hairCap.position.set(0, 0.335, -0.038);
  hairCap.rotation.x = -0.38;
  hairCap.castShadow = true;
  headGroup.add(hairCap);

  // Sculpted curved center-parted curtain bang swoop geometry
  const swoopShape = new THREE.Shape();
  swoopShape.moveTo(0, 0.14);
  swoopShape.bezierCurveTo(0.11, 0.15, 0.22, 0.08, 0.26, -0.05);
  swoopShape.bezierCurveTo(0.28, -0.15, 0.24, -0.24, 0.18, -0.28);
  swoopShape.bezierCurveTo(0.16, -0.18, 0.14, -0.08, 0.07, -0.01);
  swoopShape.bezierCurveTo(0.03, 0.03, 0.01, 0.08, 0, 0.14);
  swoopShape.closePath();

  const swoopGeo = new THREE.ExtrudeGeometry(swoopShape, {
    depth: 0.09,
    bevelEnabled: true,
    bevelThickness: 0.028,
    bevelSize: 0.022,
    bevelSegments: 3,
    curveSegments: 10,
  });
  swoopGeo.translate(0, 0, -0.045);

  for (const side of [-1, 1] as const) {
    // Lush center-parted front swoop framing the temples cleanly above glasses
    const swoop = new THREE.Mesh(swoopGeo, darkHairMat);
    swoop.position.set(side * 0.01, 0.53, 0.215);
    swoop.scale.set(side * 1.04, 0.92, 1.0);
    swoop.rotation.set(0.12, side * 0.34, -side * 0.06);
    swoop.castShadow = true;
    headGroup.add(swoop);

    // Fluffy upper side highlight lock adding depth & silhouette flare
    const outerSwoop = new THREE.Mesh(swoopGeo, hairSheenMat);
    outerSwoop.position.set(side * 0.07, 0.545, 0.125);
    outerSwoop.scale.set(side * 1.15, 0.98, 1.05);
    outerSwoop.rotation.set(0.05, side * 0.68, -side * 0.10);
    outerSwoop.castShadow = true;
    headGroup.add(outerSwoop);

    // Mid-ear / jaw sweeping lock
    const sideBackLock = createHairLock(0.36, 0.105, 0.72, darkHairMat);
    sideBackLock.position.set(side * 0.285, 0.44, -0.10);
    sideBackLock.rotation.set(-0.12, 0, side * 3.02);
    headGroup.add(sideBackLock);
  }

  // Layered nape & back hair locks tapering cleanly down the back of the head
  for (let i = -2; i <= 2; i++) {
    const backLock = createHairLock(
      0.38 - Math.abs(i) * 0.02,
      0.115,
      0.62,
      i % 2 === 0 ? darkHairMat : hairSheenMat,
    );
    backLock.position.set(i * 0.115, 0.44 - Math.abs(i) * 0.02, -0.22 + Math.abs(i) * 0.025);
    backLock.rotation.set(-0.22, i * 0.18, Math.PI + i * 0.08);
    headGroup.add(backLock);
  }

  return {
    root,
    torsoGroup,
    headGroup,
    armsGroup,
    ocarinaProp,
    leftFoot,
    rightFoot,
  };
}

export function updateMusicianRig(
  rig: MusicianRig,
  elapsed: number,
  isPlayingNote: boolean,
  semitoneShift: number,
  tiltX: number,
  tiltZ: number,
): void {
  const swaySpeed = isPlayingNote ? 4.2 : 1.5;
  const swayAmp = isPlayingNote ? 0.065 : 0.022;

  rig.torsoGroup.rotation.z = Math.sin(elapsed * swaySpeed) * swayAmp + tiltZ * 0.14;
  rig.torsoGroup.rotation.x = 0.03 + Math.sin(elapsed * 2.1) * 0.02 + tiltX * 0.12;

  rig.headGroup.rotation.y = Math.sin(elapsed * (swaySpeed * 0.7)) * 0.07;
  rig.headGroup.rotation.x =
    (isPlayingNote ? 0.07 : 0.0) + semitoneShift * -0.035 + Math.sin(elapsed * 1.9) * 0.022;
  rig.headGroup.rotation.z = Math.cos(elapsed * swaySpeed) * (isPlayingNote ? 0.045 : 0.015);

  rig.armsGroup.position.y = 0.40 + (isPlayingNote ? 0.03 : 0);
  rig.ocarinaProp.rotation.z = 0.05 + Math.sin(elapsed * 6.0) * (isPlayingNote ? 0.05 : 0.01);

  const tap = isPlayingNote ? Math.max(0, Math.sin(elapsed * 8.4)) * 0.12 : 0;
  rig.rightFoot.rotation.x = -tap;
  rig.leftFoot.rotation.x = Math.sin(elapsed * 1.8) * 0.03;
}

/**
 * Builds the sculpted companion cat seated flush at y=0:
 * plump Lathe torso, dorsal brown tabby mantle & flank stripes, fluffy chest ruff + crimson collar with gold bell,
 * tucked haunches, tapered front legs with 4-toe paws, rounded head with whisker pads, whiskers, pink nose & happy crescent eyes,
 * sculpted beveled ears with pink inner shells & ear tufts, and a smooth curved S-tail.
 */
export function createCompanionCat(): CatRig {
  const root = new THREE.Group();

  const creamMat = makeMat(0xebe1ca, 0.84, 0.02);
  const creamLightMat = makeMat(0xf7f1e3, 0.80, 0.02);
  const brownTabbyMat = makeMat(0x4b3120, 0.86, 0.02);
  const darkStripeMat = makeMat(0x2b1b11, 0.90, 0.02);
  const pinkNoseMat = makeMat(0xe8707c, 0.46, 0.04);
  const blushMat = makeMat(0xea9a90, 0.78, 0.0);
  const innerEarMat = makeMat(0xde8d86, 0.76, 0.02);
  const eyeSlitMat = makeMat(0x18110e, 0.36, 0.05);
  const collarMat = makeMat(0xa82424, 0.68, 0.06);
  const bellGoldMat = makeMat(0xf5c74c, 0.18, 0.92);
  const whiskerMat = makeMat(0xfaf6ec, 0.55, 0.02);

  // 1. Plump pear-shaped seated cat body (LatheGeometry flush at y=0)
  const bodyProfile: THREE.Vector2[] = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(0.215, 0.0),
    new THREE.Vector2(0.248, 0.08),
    new THREE.Vector2(0.256, 0.18),
    new THREE.Vector2(0.232, 0.28),
    new THREE.Vector2(0.195, 0.37),
    new THREE.Vector2(0.152, 0.44),
    new THREE.Vector2(0.01, 0.47),
  ];
  const bodyGeo = new THREE.LatheGeometry(bodyProfile, 16);
  bodyGeo.scale(1.02, 1.0, 1.14);
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, creamMat);
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  // Curved brown tabby dorsal saddle & flank stripes
  const saddleGeo = new THREE.SphereGeometry(0.228, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56);
  saddleGeo.scale(0.95, 1.15, 1.14);
  const saddle = new THREE.Mesh(saddleGeo, brownTabbyMat);
  saddle.position.set(0, 0.23, -0.06);
  saddle.rotation.x = -0.82;
  saddle.castShadow = true;
  root.add(saddle);

  for (const [zOff, rad] of [
    [-0.08, 0.235],
    [-0.16, 0.225],
  ] as const) {
    const flankStripe = createCurvedTube(
      [
        new THREE.Vector3(-rad * 0.85, 0.15, zOff),
        new THREE.Vector3(-rad * 0.5, 0.34, zOff - 0.04),
        new THREE.Vector3(0, 0.40, zOff - 0.06),
        new THREE.Vector3(rad * 0.5, 0.34, zOff - 0.04),
        new THREE.Vector3(rad * 0.85, 0.15, zOff),
      ],
      0.016,
      12,
      6,
      darkStripeMat,
    );
    root.add(flankStripe);
  }

  // Fluffy cream chest fur bib (layered sculpted tufts)
  const chestMainGeo = new THREE.SphereGeometry(0.145, 12, 10);
  chestMainGeo.scale(1.05, 1.18, 0.62);
  const chestMain = new THREE.Mesh(chestMainGeo, creamLightMat);
  chestMain.position.set(0, 0.25, 0.195);
  root.add(chestMain);

  const tuftGeo = new THREE.SphereGeometry(0.055, 8, 6);
  tuftGeo.scale(0.85, 1.45, 0.65);
  for (const [tx, ty, tz, rz] of [
    [0, 0.33, 0.255, 0],
    [-0.055, 0.31, 0.242, 0.24],
    [0.055, 0.31, 0.242, -0.24],
  ] as const) {
    const tuft = new THREE.Mesh(tuftGeo, creamLightMat);
    tuft.position.set(tx, ty, tz);
    tuft.rotation.set(0.32, 0, rz);
    root.add(tuft);
  }

  // Crimson collar + gleaming golden cat bell
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.023, 10, 20), collarMat);
  collar.rotation.x = Math.PI / 2 + 0.18;
  collar.position.set(0, 0.425, 0.045);
  root.add(collar);

  const bellLoop = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.005, 6, 10), bellGoldMat);
  bellLoop.position.set(0, 0.395, 0.198);
  const bellBall = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 10), bellGoldMat);
  bellBall.position.set(0, 0.364, 0.206);
  bellBall.castShadow = true;
  const bellGroove = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.004, 6, 12), darkStripeMat);
  bellGroove.rotation.x = Math.PI / 2;
  bellGroove.position.set(0, 0.362, 0.206);
  root.add(bellLoop, bellBall, bellGroove);

  // 2. Sculpted Front Legs, Plush Paws with 4 Toes & Tucked Hind Haunches
  const pawBaseGeo = new THREE.SphereGeometry(0.072, 12, 8);
  pawBaseGeo.scale(1.05, 0.56, 1.24);
  const toeGeo = new THREE.SphereGeometry(0.021, 8, 6);
  toeGeo.scale(0.88, 0.72, 1.15);
  const haunchGeo = new THREE.SphereGeometry(0.145, 12, 10);
  haunchGeo.scale(0.72, 0.96, 1.18);

  for (const side of [-1, 1] as const) {
    const legTop = new THREE.Vector3(side * 0.115, 0.32, 0.165);
    const legBot = new THREE.Vector3(side * 0.125, 0.04, 0.215);
    root.add(createLimbBetween(legTop, legBot, 0.068, 0.052, 10, creamLightMat));

    const paw = new THREE.Mesh(pawBaseGeo, creamLightMat);
    paw.position.set(side * 0.125, 0.036, 0.245);
    paw.castShadow = true;
    root.add(paw);

    // 4 sculpted front paw toes
    for (let t = 0; t < 4; t++) {
      const ang = (t - 1.5) * 0.28;
      const toe = new THREE.Mesh(toeGeo, creamLightMat);
      toe.position.set(
        side * 0.125 + Math.sin(ang) * 0.054,
        0.022,
        0.245 + Math.cos(ang) * 0.078,
      );
      root.add(toe);
    }

    // Tucked rounded hind thigh & small tucked back paw
    const haunch = new THREE.Mesh(haunchGeo, creamMat);
    haunch.position.set(side * 0.215, 0.135, -0.065);
    haunch.rotation.z = -side * 0.12;
    haunch.castShadow = true;
    root.add(haunch);

    const hindPaw = new THREE.Mesh(pawBaseGeo, creamLightMat);
    hindPaw.scale.set(0.82, 0.85, 0.85);
    hindPaw.position.set(side * 0.235, 0.03, 0.065);
    hindPaw.rotation.y = side * 0.35;
    root.add(hindPaw);
  }

  // 3. Smooth Curved Multi-Segment S-Tail (keeps tailBase + tailTip pivots for updateCatRig!)
  const tailBase = new THREE.Group();
  tailBase.position.set(0, 0.11, -0.25);
  root.add(tailBase);

  const tailCurve1 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.01, -0.11),
    new THREE.Vector3(0, 0.09, -0.21),
    new THREE.Vector3(0, 0.17, -0.26),
  ]);
  const tailGeo1 = new THREE.TubeGeometry(tailCurve1, 10, 0.052, 8, false);
  const tailMesh1 = new THREE.Mesh(tailGeo1, brownTabbyMat);
  tailMesh1.castShadow = true;
  tailBase.add(tailMesh1);

  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.011, 6, 12), darkStripeMat);
  ring1.position.set(0, 0.03, -0.14);
  ring1.rotation.x = 0.72;
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.050, 0.010, 6, 12), darkStripeMat);
  ring2.position.set(0, 0.12, -0.22);
  ring2.rotation.x = 0.45;
  tailBase.add(ring1, ring2);

  const tailTip = new THREE.Group();
  tailTip.position.set(0, 0.17, -0.26);
  tailBase.add(tailTip);

  const tailCurve2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.10, -0.03),
    new THREE.Vector3(0, 0.21, 0.02),
    new THREE.Vector3(0, 0.26, 0.06),
  ]);
  const tailGeo2 = new THREE.TubeGeometry(tailCurve2, 10, 0.048, 8, false);
  const tailMesh2 = new THREE.Mesh(tailGeo2, creamLightMat);
  tailMesh2.castShadow = true;
  tailTip.add(tailMesh2);

  const tailRingTip = new THREE.Mesh(new THREE.TorusGeometry(0.049, 0.009, 6, 12), brownTabbyMat);
  tailRingTip.position.set(0, 0.13, -0.01);
  tailRingTip.rotation.x = 1.4;
  tailTip.add(tailRingTip);

  const tailTipBall = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), creamLightMat);
  tailTipBall.position.set(0, 0.26, 0.06);
  tailTipBall.castShadow = true;
  tailTip.add(tailTipBall);

  // 4. Rounded Expressive Cat Head with Cheek Puffs, Fur Tufts, Whisker Pads, Whiskers, Ears & Crescent Eyes
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.565, 0.11);
  root.add(headGroup);

  const skullGeo = new THREE.SphereGeometry(0.265, 18, 14);
  skullGeo.scale(1.16, 0.88, 0.96);
  const skull = new THREE.Mesh(skullGeo, creamLightMat);
  skull.castShadow = true;
  skull.receiveShadow = true;
  headGroup.add(skull);

  // Soft chubby cheek puffs + pointed cheek fur tufts
  const cheekGeo = new THREE.SphereGeometry(0.135, 12, 10);
  cheekGeo.scale(1.05, 0.78, 0.88);
  const cheekTuftGeo = new THREE.ConeGeometry(0.032, 0.082, 6);
  for (const side of [-1, 1] as const) {
    const cheek = new THREE.Mesh(cheekGeo, creamLightMat);
    cheek.position.set(side * 0.195, -0.065, 0.045);
    headGroup.add(cheek);

    const upperTuft = new THREE.Mesh(cheekTuftGeo, creamLightMat);
    upperTuft.position.set(side * 0.30, -0.04, 0.02);
    upperTuft.rotation.z = -side * 1.25;
    headGroup.add(upperTuft);

    const lowerTuft = new THREE.Mesh(cheekTuftGeo, creamMat);
    lowerTuft.position.set(side * 0.28, -0.095, 0.025);
    lowerTuft.rotation.z = -side * 1.48;
    headGroup.add(lowerTuft);
  }

  // Curved brown tabby forehead cap (parted gently above the brow M-stripes so no ruler edge shows)
  const browCapGeo = new THREE.SphereGeometry(0.258, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.36);
  browCapGeo.scale(1.13, 0.88, 0.94);
  const browCap = new THREE.Mesh(browCapGeo, brownTabbyMat);
  browCap.position.set(0, 0.032, -0.055);
  browCap.rotation.x = -0.52;
  headGroup.add(browCap);

  // Soft curved brown tabby patches over each brow framing the M-stripes
  const browPatchGeo = new THREE.SphereGeometry(0.11, 10, 8);
  browPatchGeo.scale(1.15, 0.62, 0.85);
  for (const side of [-1, 1] as const) {
    const patch = new THREE.Mesh(browPatchGeo, brownTabbyMat);
    patch.position.set(side * 0.155, 0.155, 0.09);
    patch.rotation.set(0.38, side * 0.25, -side * 0.28);
    headGroup.add(patch);
  }

  for (const xOff of [-0.072, 0, 0.072]) {
    const stripe = createCurvedTube(
      [
        new THREE.Vector3(xOff * 1.1, 0.205, 0.05),
        new THREE.Vector3(xOff, 0.165, 0.188),
        new THREE.Vector3(xOff * 0.85, 0.105, 0.228),
      ],
      0.015,
      8,
      6,
      darkStripeMat,
    );
    headGroup.add(stripe);
  }

  // Sculpted beveled triangular cat ears with recessed pink inner ear cavity + ear fur tufts
  const outerEarShape = new THREE.Shape();
  outerEarShape.moveTo(-0.11, 0);
  outerEarShape.quadraticCurveTo(-0.10, 0.14, -0.015, 0.23);
  outerEarShape.quadraticCurveTo(0, 0.25, 0.015, 0.23);
  outerEarShape.quadraticCurveTo(0.10, 0.14, 0.11, 0);
  outerEarShape.closePath();

  const outerEarGeo = new THREE.ExtrudeGeometry(outerEarShape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.022,
    bevelSize: 0.018,
    bevelSegments: 3,
    curveSegments: 8,
  });
  outerEarGeo.translate(0, 0, -0.025);

  const innerEarShape = new THREE.Shape();
  innerEarShape.moveTo(-0.065, 0.02);
  innerEarShape.quadraticCurveTo(-0.055, 0.11, 0, 0.175);
  innerEarShape.quadraticCurveTo(0.055, 0.11, 0.065, 0.02);
  innerEarShape.closePath();
  const innerEarGeo = new THREE.ExtrudeGeometry(innerEarShape, {
    depth: 0.02,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.006,
    bevelSegments: 2,
    curveSegments: 6,
  });

  const buildEar = (side: -1 | 1): THREE.Group => {
    const earG = new THREE.Group();
    earG.position.set(side * 0.19, 0.165, 0.015);
    earG.rotation.z = -side * 0.24;
    earG.rotation.y = side * 0.22;

    const outer = new THREE.Mesh(outerEarGeo, brownTabbyMat);
    outer.castShadow = true;
    earG.add(outer);

    const inner = new THREE.Mesh(innerEarGeo, innerEarMat);
    inner.position.set(0, 0.005, 0.024);
    earG.add(inner);

    // Cream fluffy ear-base fur tuft
    const earTuft = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.075, 6), creamLightMat);
    earTuft.position.set(-side * 0.04, 0.035, 0.04);
    earTuft.rotation.z = -side * 0.55;
    earG.add(earTuft);

    headGroup.add(earG);
    return earG;
  };

  const leftEar = buildEar(-1);
  const rightEar = buildEar(1);

  // Smooth Curved Happy Crescent Eyes + Cheek Blush + Whiskers
  const whiskerGeo = new THREE.CylinderGeometry(0.0052, 0.0022, 0.185, 5);
  whiskerGeo.rotateZ(Math.PI / 2);

  for (const side of [-1, 1] as const) {
    // Happy curved crescent eye
    const eyeArc = createCurvedTube(
      [
        new THREE.Vector3(side * 0.075, 0.012, 0.242),
        new THREE.Vector3(side * 0.132, 0.042, 0.246),
        new THREE.Vector3(side * 0.188, 0.010, 0.222),
      ],
      0.012,
      10,
      6,
      eyeSlitMat,
    );
    headGroup.add(eyeArc);

    // Soft pink cheek blush beneath eye
    const blush = new THREE.Mesh(
      new THREE.SphereGeometry(0.042, 10, 8).scale(1.3, 0.65, 0.25),
      blushMat,
    );
    blush.position.set(side * 0.178, -0.048, 0.216);
    blush.rotation.y = side * 0.42;
    headGroup.add(blush);

    // Puffed whisker pad
    const pad = new THREE.Mesh(
      new THREE.SphereGeometry(0.062, 10, 8).scale(1.12, 0.86, 0.88),
      creamLightMat,
    );
    pad.position.set(side * 0.052, -0.068, 0.224);
    headGroup.add(pad);

    // 3 delicate fanned whiskers per cheek
    for (let w = -1; w <= 1; w++) {
      const whisker = new THREE.Mesh(whiskerGeo, whiskerMat);
      whisker.position.set(side * 0.205, -0.062 + w * 0.022, 0.205);
      whisker.rotation.set(0, -side * 0.28, side * (w * 0.16 - 0.04));
      headGroup.add(whisker);
    }
  }

  // Sculpted coral-pink feline nose
  const noseGeo = new THREE.SphereGeometry(0.036, 10, 8);
  noseGeo.scale(1.18, 0.82, 0.78);
  const nose = new THREE.Mesh(noseGeo, pinkNoseMat);
  nose.position.set(0, -0.038, 0.258);
  headGroup.add(nose);

  // Cute feline 'w' mouth smile
  for (const side of [-1, 1] as const) {
    const smileArc = createCurvedTube(
      [
        new THREE.Vector3(0, -0.066, 0.256),
        new THREE.Vector3(side * 0.028, -0.088, 0.252),
        new THREE.Vector3(side * 0.058, -0.072, 0.240),
      ],
      0.007,
      8,
      5,
      eyeSlitMat,
    );
    headGroup.add(smileArc);
  }

  return {
    root,
    headGroup,
    tailBase,
    tailTip,
    leftEar,
    rightEar,
  };
}

export function updateCatRig(
  rig: CatRig,
  elapsed: number,
  isPlayingNote: boolean,
  comboLevel: number,
): void {
  const rhythmFreq = isPlayingNote ? 4.4 : 1.8;
  const bobAmp = isPlayingNote ? 0.065 : 0.025;

  rig.headGroup.rotation.z = Math.sin(elapsed * rhythmFreq) * bobAmp;
  rig.headGroup.rotation.x = Math.sin(elapsed * 2.2) * 0.04 + (isPlayingNote ? -0.05 : 0);
  rig.headGroup.rotation.y = Math.cos(elapsed * 1.1) * 0.06;

  const tailSpeed = 2.6 + Math.min(4.0, comboLevel * 0.2);
  rig.tailBase.rotation.y = Math.sin(elapsed * tailSpeed) * 0.34;
  rig.tailTip.rotation.y = Math.sin(elapsed * tailSpeed - 0.8) * 0.28;

  const twitch = Math.pow(Math.max(0, Math.sin(elapsed * 1.7 + 0.5)), 16) * 0.22;
  rig.leftEar.rotation.z = 0.24 + twitch;
  rig.rightEar.rotation.z = -0.24 - twitch * 0.5;
}

/**
 * Builds the richly detailed distant stone & timber lakeside fishing quay with
 * two articulated fishing villagers (hat/glasses/vests/arms/boots + tackle crate & dock lantern),
 * plus the moonlit medieval Hyrule harbor seawall, streetlamps, Tudor half-timbered cottages,
 * pointed castle spires with chimneys, dormers, arched doors, framed mullioned windows & pine trees.
 */
export function createMoonlitVillageAndFishermen(): VillagePropsRig {
  const root = new THREE.Group();

  const stonePierMat = makeMat(0x2c3246, 0.90, 0.04, true);
  const pierTrimMat = makeMat(0x3a4159, 0.86, 0.05, true);
  const timberDarkMat = makeMat(0x3b2616, 0.88, 0.03);
  const plankWoodMat = makeMat(0x5c3c22, 0.86, 0.02);
  const ropeMat = makeMat(0xb89660, 0.92, 0.01);
  const ironMat = makeMat(0x161b26, 0.45, 0.65);
  const brassMat = makeMat(0xf4c44e, 0.22, 0.88);

  const darkRoofMat = makeMat(0x11152c, 0.86, 0.06, true);
  const slateTrimMat = makeMat(0x212744, 0.82, 0.08, true);
  const wallSilMat = makeMat(0x1e243e, 0.90, 0.04, true);
  const plasterSilMat = makeMat(0x2a3150, 0.88, 0.03, true);
  const woodBeamMat = makeMat(0x141728, 0.88, 0.03, true);

  const windowGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 2.1,
    roughness: 0.25,
  });

  // 1. Detailed Stone & Timber Lakeside Quay behind player's left shoulder
  const pierGroup = new THREE.Group();
  pierGroup.position.set(-1.35, -0.38, -4.15);

  // Main masonry quay + overhanging cobble coping + vertical stone pilasters
  const quayBase = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.64, 1.42), stonePierMat);
  quayBase.position.set(0.05, 0.32, 0);
  quayBase.receiveShadow = true;
  quayBase.castShadow = true;
  pierGroup.add(quayBase);

  const quayCoping = new THREE.Mesh(new THREE.BoxGeometry(2.78, 0.08, 1.54), pierTrimMat);
  quayCoping.position.set(0.05, 0.66, 0);
  quayCoping.receiveShadow = true;
  quayCoping.castShadow = true;
  pierGroup.add(quayCoping);

  for (const px of [-1.22, -0.40, 0.45, 1.32]) {
    const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.68, 0.12), pierTrimMat);
    pilaster.position.set(px, 0.34, 0.72);
    pierGroup.add(pilaster);
  }

  // Weathered timber plank walkway strip across the top of the pier
  for (let i = 0; i < 9; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.035, 1.18), plankWoodMat);
    plank.position.set(-1.05 + i * 0.28, 0.71, -0.04);
    plank.receiveShadow = true;
    pierGroup.add(plank);
  }

  // Submerged timber dock pilings + coiled mooring ropes
  for (const [tx, tz] of [
    [-1.24, 0.78],
    [1.34, 0.78],
    [-1.24, -0.78],
    [1.34, -0.78],
  ] as const) {
    const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 1.18, 8), timberDarkMat);
    piling.position.set(tx, 0.52, tz);
    piling.castShadow = true;
    pierGroup.add(piling);

    const pilingCap = new THREE.Mesh(new THREE.ConeGeometry(0.092, 0.08, 8), timberDarkMat);
    pilingCap.position.set(tx, 1.14, tz);
    pierGroup.add(pilingCap);

    if (tz > 0) {
      const ropeCoil = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.022, 6, 12), ropeMat);
      ropeCoil.rotation.x = Math.PI / 2;
      ropeCoil.position.set(tx, 0.84, tz);
      pierGroup.add(ropeCoil);
    }
  }

  // Dockside Wooden Tackle Crate + Fish Bucket with metallic hoops
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.24, 0.28), plankWoodMat);
  crate.position.set(0.58, 0.84, -0.18);
  crate.rotation.y = 0.22;
  crate.castShadow = true;
  pierGroup.add(crate);

  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.095, 0.22, 10), plankWoodMat);
  bucket.position.set(-0.96, 0.83, 0.22);
  bucket.castShadow = true;
  const hoop1 = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.01, 6, 12), ironMat);
  hoop1.rotation.x = Math.PI / 2;
  hoop1.position.set(-0.96, 0.89, 0.22);
  const hoop2 = new THREE.Mesh(new THREE.TorusGeometry(0.102, 0.01, 6, 12), ironMat);
  hoop2.rotation.x = Math.PI / 2;
  hoop2.position.set(-0.96, 0.77, 0.22);
  const fishBody = new THREE.Mesh(
    new THREE.SphereGeometry(0.048, 8, 6).scale(0.65, 1.5, 0.45),
    makeMat(0x94a3b8, 0.28, 0.55),
  );
  fishBody.position.set(-0.94, 0.96, 0.22);
  fishBody.rotation.z = -0.35;
  pierGroup.add(bucket, hoop1, hoop2, fishBody);

  // Warm Glowing Wrought-Iron Harbor Lantern Post on the right side of the pier
  const postBase = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.09, 0.16, 8), ironMat);
  postBase.position.set(0.95, 0.78, -0.24);
  const postShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.045, 1.25, 8), ironMat);
  postShaft.position.set(0.95, 1.44, -0.24);
  const armBracket = createCurvedTube(
    [
      new THREE.Vector3(0.95, 1.98, -0.24),
      new THREE.Vector3(0.84, 2.12, -0.18),
      new THREE.Vector3(0.68, 2.04, -0.12),
    ],
    0.018,
    8,
    6,
    ironMat,
  );
  const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.11, 6), ironMat);
  lanternCap.position.set(0.68, 1.97, -0.12);
  const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.16, 6), windowGlowMat);
  lanternGlass.position.set(0.68, 1.85, -0.12);
  const pierLight = new THREE.PointLight(0xffaa44, 1.45, 4.8, 2);
  pierLight.position.set(0.68, 1.82, -0.05);
  pierGroup.add(postBase, postShaft, armBracket, lanternCap, lanternGlass, pierLight);

  // 2. Two Detailed Sculpted Fishing Villagers on the Quay
  const skinMat = makeMat(0xefc08e, 0.74, 0.02);
  const hairMat = makeMat(0x24150f, 0.86, 0.02);
  const vestMat = makeMat(0xd96832, 0.82, 0.04);
  const whiteShirtMat = makeMat(0xe5e7eb, 0.84, 0.02);
  const darkSuitMat = makeMat(0x181c2b, 0.84, 0.05);
  const trouserMat = makeMat(0x262c3e, 0.88, 0.03);
  const vBootMat = makeMat(0x522a16, 0.55, 0.06);
  const strawHatMat = makeMat(0xd4a957, 0.88, 0.02);
  const hatRibbonMat = makeMat(0x88241d, 0.8, 0.04);
  const eyeDarkMat = makeMat(0x120d0c, 0.35, 0.05);

  const buildDetailedVillager = (
    x: number,
    jacketMat: THREE.Material,
    hasStrawHat: boolean,
    hasSpecs: boolean,
  ) => {
    const g = new THREE.Group();
    g.position.set(x, 0.72, 0.34);

    // Tapered torso + leather belt + collar
    const torsoGeo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.01, 0),
        new THREE.Vector2(0.145, 0.02),
        new THREE.Vector2(0.135, 0.16),
        new THREE.Vector2(0.142, 0.27),
        new THREE.Vector2(0.085, 0.33),
        new THREE.Vector2(0.01, 0.34),
      ],
      12,
    );
    torsoGeo.scale(1.05, 1.0, 0.78);
    const body = new THREE.Mesh(torsoGeo, jacketMat);
    body.castShadow = true;
    g.add(body);

    const vBelt = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.016, 6, 12), timberDarkMat);
    vBelt.rotation.x = Math.PI / 2;
    vBelt.scale.set(1.04, 0.80, 1);
    vBelt.position.y = 0.06;
    g.add(vBelt);

    const vCollar = new THREE.Mesh(new THREE.TorusGeometry(0.086, 0.022, 6, 12), whiteShirtMat);
    vCollar.rotation.x = Math.PI / 2 + 0.12;
    vCollar.position.set(0, 0.315, 0.01);
    g.add(vCollar);

    // Seated thighs, shins & little leather boots dangling over pier lip
    for (const side of [-1, 1] as const) {
      const hip = new THREE.Vector3(side * 0.075, 0.03, 0.04);
      const knee = new THREE.Vector3(side * 0.08, 0.02, 0.22);
      const ankle = new THREE.Vector3(side * 0.08, -0.17, 0.24);
      g.add(createLimbBetween(hip, knee, 0.056, 0.048, 8, trouserMat));
      g.add(createLimbBetween(knee, ankle, 0.048, 0.04, 8, trouserMat));

      const vBoot = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.06, 4, 8), vBootMat);
      vBoot.rotation.x = Math.PI / 2;
      vBoot.position.set(side * 0.08, -0.20, 0.27);
      g.add(vBoot);
    }

    // Rounded head, hair, face & optional straw hat or tiny spectacles
    const headG = new THREE.Group();
    headG.position.set(0, 0.45, 0.02);
    g.add(headG);

    const vHead = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), skinMat);
    vHead.scale.set(1.04, 0.94, 0.96);
    vHead.castShadow = true;
    headG.add(vHead);

    const vHair = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.60),
      hairMat,
    );
    vHair.position.set(0, 0.015, -0.02);
    vHair.rotation.x = -0.36;
    headG.add(vHair);

    for (const side of [-1, 1] as const) {
      const vEar = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 6), skinMat);
      vEar.position.set(side * 0.15, -0.01, -0.01);
      const vEye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), eyeDarkMat);
      vEye.position.set(side * 0.058, 0.01, 0.138);
      headG.add(vEar, vEye);

      if (hasSpecs) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.006, 6, 10), ironMat);
        rim.position.set(side * 0.058, 0.01, 0.148);
        headG.add(rim);
      }
    }

    const vNose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), skinMat);
    vNose.position.set(0, -0.018, 0.148);
    headG.add(vNose);

    if (hasStrawHat) {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.30, 0.022, 14), strawHatMat);
      brim.position.set(0, 0.095, -0.01);
      brim.rotation.x = -0.12;
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.165, 0.11, 12), strawHatMat);
      crown.position.set(0, 0.155, -0.015);
      crown.rotation.x = -0.12;
      const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.162, 0.166, 0.028, 12), hatRibbonMat);
      ribbon.position.set(0, 0.115, -0.01);
      ribbon.rotation.x = -0.12;
      headG.add(brim, crown, ribbon);
    }

    return g;
  };

  // Left Villager: Fisherman in white shirt + orange vest + straw hat gripping the rod
  const fisher = buildDetailedVillager(-0.56, whiteShirtMat, true, false);
  const fisherVest = new THREE.Mesh(
    new THREE.CylinderGeometry(0.148, 0.152, 0.22, 10, 1, true, -Math.PI * 0.78, Math.PI * 1.56),
    vestMat,
  );
  fisherVest.position.set(0, 0.16, 0);
  fisherVest.rotation.y = Math.PI;
  fisher.add(fisherVest);

  for (const side of [-1, 1] as const) {
    const sh = new THREE.Vector3(side * 0.14, 0.24, 0.0);
    const el = new THREE.Vector3(side * 0.16, 0.13, 0.10);
    const hd = new THREE.Vector3(side * 0.04, 0.17, 0.25);
    fisher.add(createLimbBetween(sh, el, 0.042, 0.036, 8, whiteShirtMat));
    fisher.add(createLimbBetween(el, hd, 0.036, 0.032, 8, skinMat));
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), skinMat);
    hand.position.copy(hd);
    fisher.add(hand);
  }
  fisher.rotation.y = -0.62;

  // Right Buddy: Dark jacket + tiny glasses + hands resting casually on knees
  const buddy = buildDetailedVillager(-0.08, darkSuitMat, false, true);
  for (const side of [-1, 1] as const) {
    const sh = new THREE.Vector3(side * 0.14, 0.24, 0.0);
    const el = new THREE.Vector3(side * 0.16, 0.11, 0.08);
    const hd = new THREE.Vector3(side * 0.09, 0.05, 0.21);
    buddy.add(createLimbBetween(sh, el, 0.042, 0.036, 8, darkSuitMat));
    buddy.add(createLimbBetween(el, hd, 0.036, 0.032, 8, darkSuitMat));
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 6), skinMat);
    hand.position.copy(hd);
    buddy.add(hand);
  }
  buddy.rotation.y = -0.25;

  pierGroup.add(fisher, buddy);

  // Detailed Fishing Rod (cork grip, brass reel, guide rings, tapered rod) pointing LEFT over water
  const rodTipGroup = new THREE.Group();
  rodTipGroup.position.set(-0.68, 0.90, 0.44);
  rodTipGroup.rotation.set(0.28, -1.35, 0.0);

  const corkGrip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.030, 0.34, 8),
    makeMat(0xb5864c, 0.85, 0.02),
  );
  corkGrip.rotation.x = Math.PI / 2;
  corkGrip.position.z = 0.04;
  rodTipGroup.add(corkGrip);

  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.045, 10), brassMat);
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0.035, -0.02, 0.18);
  rodTipGroup.add(reel);

  const rodMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.024, 1.98, 8), plankWoodMat);
  rodMesh.rotation.x = Math.PI / 2;
  rodMesh.position.z = 1.02;
  rodTipGroup.add(rodMesh);

  for (const gz of [0.62, 1.18, 1.72, 1.98]) {
    const guide = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 6, 8), ironMat);
    guide.position.set(0, -0.018, gz);
    rodTipGroup.add(guide);
  }
  pierGroup.add(rodTipGroup);

  // Taut Silver Fishing Line + Two-Tone Red/White Bobber + Water Ripple Ring
  const lineMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.005, 1.38, 4),
    makeMat(0xe2e8f0, 0.4, 0.3),
  );
  lineMesh.position.set(-2.55, 0.72, 0.82);
  pierGroup.add(lineMesh);

  const bobber = new THREE.Mesh(
    new THREE.SphereGeometry(0.072, 10, 8),
    makeMat(0xef4444, 0.36, 0.1),
  );
  bobber.position.set(-2.55, 0.04, 0.82);
  const bobberLower = new THREE.Mesh(
    new THREE.SphereGeometry(0.071, 10, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
    whiteShirtMat,
  );
  bobber.add(bobberLower);
  const bobberPin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.09, 6), whiteShirtMat);
  bobberPin.position.y = 0.08;
  bobber.add(bobberPin);
  pierGroup.add(bobber);

  const bobberRipple = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 0.16, 16),
    new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
  );
  bobberRipple.rotation.x = -Math.PI / 2;
  bobberRipple.position.set(-2.55, 0.016, 0.82);
  pierGroup.add(bobberRipple);

  root.add(pierGroup);

  // 3. Continuous Cobblestone Harbor Seawall Promenade + Glowing Streetlamps across the Moonlit Lake
  const seawall = new THREE.Mesh(new THREE.BoxGeometry(24.0, 0.9, 1.8), wallSilMat);
  seawall.position.set(-2.5, -0.35, -14.1);
  root.add(seawall);

  const seawallCap = new THREE.Mesh(new THREE.BoxGeometry(24.2, 0.16, 1.95), slateTrimMat);
  seawallCap.position.set(-2.5, 0.16, -14.1);
  root.add(seawallCap);

  for (const lx of [-10.8, -7.8, -4.7, -1.2, 2.2, 5.4]) {
    const lampGroup = new THREE.Group();
    lampGroup.position.set(lx, 0.24, -13.3);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.085, 1.45, 6), ironMat);
    pole.position.y = 0.72;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.10, 0.26, 6), windowGlowMat);
    head.position.y = 1.50;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.14, 6), ironMat);
    cap.position.y = 1.68;
    lampGroup.add(pole, head, cap);
    root.add(lampGroup);
  }

  // Helper: Low-Poly Pine / Cypress Trees nestled between village cottages
  const foliageMat = makeMat(0x0d1b2a, 0.9, 0.02, true);
  const buildVillageTree = (x: number, z: number, scale: number) => {
    const tg = new THREE.Group();
    tg.position.set(x, 0.20, z);
    tg.scale.setScalar(scale);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 1.0, 6), timberDarkMat);
    trunk.position.y = 0.5;
    tg.add(trunk);
    for (let t = 0; t < 3; t++) {
      const tier = new THREE.Mesh(
        new THREE.ConeGeometry(0.95 - t * 0.22, 1.35 - t * 0.15, 7),
        foliageMat,
      );
      tier.position.y = 1.35 + t * 0.78;
      tg.add(tier);
    }
    root.add(tg);
  };

  buildVillageTree(-11.4, -14.6, 1.15);
  buildVillageTree(-7.9, -15.4, 0.95);
  buildVillageTree(-4.8, -14.7, 1.05);
  buildVillageTree(-1.3, -15.1, 0.90);
  buildVillageTree(2.1, -15.2, 1.10);
  buildVillageTree(5.4, -15.6, 1.20);

  // 4. Detailed Medieval Tudor Cottages & Pointed Castle Spires across the Lake
  const buildFramedWindow = (w: number, h: number, arched = false) => {
    const wg = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.08), woodBeamMat);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.10), windowGlowMat);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.18, 0.07, 0.16), slateTrimMat);
    sill.position.y = -h / 2 - 0.04;
    const barH = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, 0.12), woodBeamMat);
    const barV = new THREE.Mesh(new THREE.BoxGeometry(0.04, h, 0.12), woodBeamMat);
    wg.add(frame, pane, sill, barH, barV);
    if (arched) {
      const arch = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.10, 8), windowGlowMat);
      arch.rotation.x = Math.PI / 2;
      arch.position.y = h / 2;
      wg.add(arch);
    }
    return wg;
  };

  const buildDetailedBuilding = (
    x: number,
    z: number,
    ry: number,
    w: number,
    h: number,
    d: number,
    roofH: number,
    isSpire: boolean,
  ) => {
    const cg = new THREE.Group();
    cg.position.set(x, -0.38, z);
    cg.rotation.y = ry;

    // Lower Stone Foundation Plinth + Upper Timber-Framed Story
    const baseH = h * 0.42;
    const upperH = h - baseH;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, baseH, d + 0.14), wallSilMat);
    plinth.position.y = baseH / 2;
    cg.add(plinth);

    const ledge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.24, 0.14, d + 0.24), slateTrimMat);
    ledge.position.y = baseH;
    cg.add(ledge);

    const upper = new THREE.Mesh(new THREE.BoxGeometry(w, upperH, d), plasterSilMat);
    upper.position.y = baseH + upperH / 2;
    cg.add(upper);

    // Tudor Vertical Corner Posts & Horizontal Timber Framing
    for (const cx of [-w / 2 + 0.06, 0, w / 2 - 0.06]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, upperH, d + 0.06), woodBeamMat);
      post.position.set(cx, baseH + upperH / 2, 0);
      cg.add(post);
    }
    const midBeam = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.13, d + 0.08), woodBeamMat);
    midBeam.position.y = baseH + upperH * 0.52;
    cg.add(midBeam);

    // Overhanging Pitched Gable Roof OR Steep Spire + Eaves & Finial
    if (isSpire) {
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(w, d) * 0.84, roofH, 4),
        darkRoofMat,
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.y = h + roofH / 2;
      cg.add(roof);

      const eaves = new THREE.Mesh(new THREE.BoxGeometry(w + 0.34, 0.16, d + 0.34), slateTrimMat);
      eaves.position.y = h + 0.04;
      cg.add(eaves);

      const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.05, 0.55, 6), slateTrimMat);
      finial.position.y = h + roofH + 0.22;
      const finialOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), brassMat);
      finialOrb.position.y = h + roofH + 0.50;
      cg.add(finial, finialOrb);
    } else {
      const gableShape = new THREE.Shape();
      gableShape.moveTo(-w * 0.60, 0);
      gableShape.lineTo(w * 0.60, 0);
      gableShape.lineTo(0, roofH);
      gableShape.closePath();

      const roofGeo = new THREE.ExtrudeGeometry(gableShape, {
        depth: d + 0.46,
        bevelEnabled: true,
        bevelThickness: 0.06,
        bevelSize: 0.05,
        bevelSegments: 2,
      });
      roofGeo.translate(0, 0, -(d + 0.46) / 2);
      const roof = new THREE.Mesh(roofGeo, darkRoofMat);
      roof.position.y = h - 0.04;
      cg.add(roof);

      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, d + 0.56), slateTrimMat);
      ridge.position.y = h + roofH - 0.02;
      cg.add(ridge);

      // Tall Stone Chimney rising beside roof ridge
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.38, roofH * 0.9, 0.38), wallSilMat);
      chimney.position.set(w * 0.28, h + roofH * 0.58, -d * 0.15);
      const chimCap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.48), slateTrimMat);
      chimCap.position.set(w * 0.28, h + roofH * 1.04, -d * 0.15);
      cg.add(chimney, chimCap);
    }

    // Framed Mullioned Glowing Windows + Ground-Floor Arched Doorway
    const win1 = buildFramedWindow(0.34, 0.44, isSpire);
    win1.position.set(-w * 0.22, baseH + upperH * 0.52, d / 2 + 0.04);
    cg.add(win1);

    const win2 = buildFramedWindow(0.34, 0.44, isSpire);
    win2.position.set(w * 0.22, baseH + upperH * 0.52, d / 2 + 0.04);
    cg.add(win2);

    if (isSpire) {
      const upperWin = buildFramedWindow(0.28, 0.46, true);
      upperWin.position.set(0, h + roofH * 0.24, d * 0.36);
      cg.add(upperWin);
    }

    const door = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.72, 0.12), timberDarkMat);
    door.position.set(0, 0.56, d / 2 + 0.06);
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.80, 0.08), slateTrimMat);
    doorFrame.position.set(0, 0.58, d / 2 + 0.04);
    const doorLantern = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 6), windowGlowMat);
    doorLantern.position.set(0.34, 0.88, d / 2 + 0.14);
    cg.add(doorFrame, door, doorLantern);

    root.add(cg);
  };

  buildDetailedBuilding(-9.4, -15.6, 0.36, 2.9, 2.9, 2.5, 1.9, false);
  buildDetailedBuilding(-6.5, -16.8, 0.18, 2.0, 4.2, 2.0, 2.6, true);
  buildDetailedBuilding(-3.1, -15.1, 0.20, 2.5, 2.5, 2.2, 1.7, false);
  buildDetailedBuilding(0.6, -15.8, -0.16, 2.7, 2.7, 2.2, 1.8, false);
  buildDetailedBuilding(3.8, -17.0, -0.32, 2.2, 4.0, 2.1, 2.5, true);

  return {
    root,
    bobber,
    rodTipGroup,
  };
}

